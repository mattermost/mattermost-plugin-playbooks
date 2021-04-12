package main

import (
	"net/http"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/api"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/command"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/sqlstore"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/telemetry"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-api/cluster"
)

// These credentials for Rudder need to be populated at build-time,
// passing the following flags to the go build command:
// -ldflags "-X main.rudderDataplaneURL=<url> -X main.rudderWriteKey=<write_key>"
var (
	rudderDataplaneURL string
	rudderWriteKey     string
)

// Plugin implements the interface expected by the Mattermost server to communicate between the
// server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	handler         *api.Handler
	config          *config.ServiceImpl
	incidentService incident.Service
	playbookService playbook.Service
	bot             *bot.Bot
}

// ServeHTTP routes incoming HTTP requests to the plugin's REST API.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.handler.ServeHTTP(w, r)
}

// OnActivate Called when this plugin is activated.
func (p *Plugin) OnActivate() error {
	pluginAPIClient := pluginapi.NewClient(p.API)

	p.config = config.NewConfigService(pluginAPIClient, manifest)
	pluginapi.ConfigureLogrus(logrus.New(), pluginAPIClient)

	botID, err := pluginAPIClient.Bot.EnsureBot(&model.Bot{
		Username:    "incident",
		DisplayName: "Incident Bot",
		Description: "Incident Collaboration plugin's bot.",
	},
		pluginapi.ProfileImagePath("assets/incident_plugin_icon.png"),
	)

	if err != nil {
		return errors.Wrapf(err, "failed to ensure incident bot")
	}
	err = p.config.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
		c.AdminLogLevel = "debug"
	})
	if err != nil {
		return errors.Wrapf(err, "failed save bot to config")
	}

	p.bot = bot.New(pluginAPIClient, botID, p.config)

	var telemetryClient interface {
		incident.Telemetry
		playbook.Telemetry
		Enable() error
		Disable() error
	}

	if rudderDataplaneURL == "" || rudderWriteKey == "" {
		pluginAPIClient.Log.Warn("Rudder credentials are not set. Disabling analytics.")
		telemetryClient = &telemetry.NoopTelemetry{}
	} else {
		diagnosticID := pluginAPIClient.System.GetDiagnosticID()
		serverVersion := pluginAPIClient.System.GetServerVersion()
		telemetryClient, err = telemetry.NewRudder(rudderDataplaneURL, rudderWriteKey, diagnosticID, manifest.Version, serverVersion)
		if err != nil {
			return errors.Wrapf(err, "failed init telemetry client")
		}
	}

	toggleTelemetry := func() {
		diagnosticsFlag := pluginAPIClient.Configuration.GetConfig().LogSettings.EnableDiagnostics
		telemetryEnabled := diagnosticsFlag != nil && *diagnosticsFlag

		if telemetryEnabled {
			if err = telemetryClient.Enable(); err != nil {
				pluginAPIClient.Log.Warn("Telemetry could not be enabled", "Error", err)
			}
			return
		}

		if err = telemetryClient.Disable(); err != nil {
			pluginAPIClient.Log.Error("Telemetry could not be disabled", "Error", err)
		}
	}

	toggleTelemetry()
	p.config.RegisterConfigChangeListener(toggleTelemetry)

	apiClient := sqlstore.NewClient(pluginAPIClient)
	sqlStore, err := sqlstore.New(apiClient, p.bot)
	if err != nil {
		return errors.Wrapf(err, "failed creating the SQL store")
	}

	mutex, err := cluster.NewMutex(p.API, "IR_dbMutex")
	if err != nil {
		return errors.Wrapf(err, "failed creating cluster mutex")
	}

	mutex.Lock()
	if err = sqlStore.RunMigrations(); err != nil {
		mutex.Unlock()
		return errors.Wrapf(err, "failed to run migrations")
	}
	mutex.Unlock()

	incidentStore := sqlstore.NewIncidentStore(apiClient, p.bot, sqlStore)
	playbookStore := sqlstore.NewPlaybookStore(apiClient, p.bot, sqlStore)
	statsStore := sqlstore.NewStatsStore(apiClient, p.bot, sqlStore)

	p.handler = api.NewHandler(p.config)
	p.bot = bot.New(pluginAPIClient, p.config.GetConfiguration().BotUserID, p.config)

	scheduler := cluster.GetJobOnceScheduler(p.API)

	p.incidentService = incident.NewService(
		pluginAPIClient,
		incidentStore,
		p.bot,
		p.bot,
		p.config,
		scheduler,
		telemetryClient,
	)

	if err = scheduler.SetCallback(p.incidentService.HandleReminder); err != nil {
		pluginAPIClient.Log.Error("JobOnceScheduler could not add the incidentService's HandleReminder", "error", err.Error())
	}
	if err = scheduler.Start(); err != nil {
		pluginAPIClient.Log.Error("JobOnceScheduler could not start", "error", err.Error())
	}

	p.playbookService = playbook.NewService(playbookStore, p.bot, telemetryClient)

	api.NewPlaybookHandler(p.handler.APIRouter, p.playbookService, pluginAPIClient, p.bot, p.config)
	api.NewIncidentHandler(
		p.handler.APIRouter,
		p.incidentService,
		p.playbookService,
		pluginAPIClient,
		p.bot,
		p.bot,
		telemetryClient,
		p.config,
	)
	api.NewStatsHandler(p.handler.APIRouter, pluginAPIClient, p.bot, statsStore, p.config)

	isTestingEnabled := false
	flag := p.API.GetConfig().ServiceSettings.EnableTesting
	if flag != nil {
		isTestingEnabled = *flag
	}
	if err = command.RegisterCommands(p.API.RegisterCommand, isTestingEnabled); err != nil {
		return errors.Wrapf(err, "failed register commands")
	}

	p.API.LogDebug("Incident collaboration plugin Activated")

	// prevent a recursive OnConfigurationChange
	go func() {
		// Remove the prepackaged old version of the plugin
		_ = pluginAPIClient.Plugin.Remove("com.mattermost.plugin-incident-response")
	}()

	return nil
}

// OnConfigurationChange handles any change in the configuration.
func (p *Plugin) OnConfigurationChange() error {
	if p.config == nil {
		return nil
	}

	return p.config.OnConfigurationChange()
}

// ExecuteCommand executes a command that has been previously registered via the RegisterCommand.
func (p *Plugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	runner := command.NewCommandRunner(c, args, pluginapi.NewClient(p.API), p.bot, p.bot, p.incidentService, p.playbookService, p.config)

	if err := runner.Execute(); err != nil {
		return nil, model.NewAppError("IncidentCollaborationPlugin.ExecuteCommand", "Unable to execute command.", nil, err.Error(), http.StatusInternalServerError)
	}

	return &model.CommandResponse{}, nil
}
