package main

import (
	"net/http"

	"github.com/mattermost/mattermost-plugin-playbooks/server/api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/command"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore"
	"github.com/mattermost/mattermost-plugin-playbooks/server/telemetry"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
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

	handler            *api.Handler
	config             *config.ServiceImpl
	playbookRunService app.PlaybookRunService
	playbookService    app.PlaybookService
	bot                *bot.Bot
	pluginAPI          *pluginapi.Client
}

// ServeHTTP routes incoming HTTP requests to the plugin's REST API.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.handler.ServeHTTP(w, r)
}

// OnActivate Called when this plugin is activated.
func (p *Plugin) OnActivate() error {
	pluginAPIClient := pluginapi.NewClient(p.API, p.Driver)
	p.pluginAPI = pluginAPIClient

	p.config = config.NewConfigService(pluginAPIClient, manifest)
	pluginapi.ConfigureLogrus(logrus.New(), pluginAPIClient)

	botID, err := pluginAPIClient.Bot.EnsureBot(&model.Bot{
		Username:    "playbooks",
		DisplayName: "Playbooks",
		Description: "Playbooks bot.",
	},
		pluginapi.ProfileImagePath("assets/plugin_icon.png"),
	)
	if err != nil {
		return errors.Wrapf(err, "failed to ensure bot")
	}

	err = p.config.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
		c.AdminLogLevel = "debug"
	})
	if err != nil {
		return errors.Wrapf(err, "failed save bot to config")
	}

	var telemetryClient interface {
		app.PlaybookRunTelemetry
		app.PlaybookTelemetry
		bot.Telemetry
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
	p.bot = bot.New(pluginAPIClient, p.config.GetConfiguration().BotUserID, p.config, telemetryClient)
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

	playbookRunStore := sqlstore.NewPlaybookRunStore(apiClient, p.bot, sqlStore)
	playbookStore := sqlstore.NewPlaybookStore(apiClient, p.bot, sqlStore)
	statsStore := sqlstore.NewStatsStore(apiClient, p.bot, sqlStore)
	userInfoStore := sqlstore.NewUserInfoStore(sqlStore)

	p.handler = api.NewHandler(pluginAPIClient, p.config, p.bot)

	scheduler := cluster.GetJobOnceScheduler(p.API)

	p.playbookRunService = app.NewPlaybookRunService(
		pluginAPIClient,
		playbookRunStore,
		p.bot,
		p.bot,
		p.config,
		scheduler,
		telemetryClient,
		p.API,
	)

	if err = scheduler.SetCallback(p.playbookRunService.HandleReminder); err != nil {
		pluginAPIClient.Log.Error("JobOnceScheduler could not add the playbookRunService's HandleReminder", "error", err.Error())
	}
	if err = scheduler.Start(); err != nil {
		pluginAPIClient.Log.Error("JobOnceScheduler could not start", "error", err.Error())
	}

	keywordsThreadIgnorer := app.NewKeywordsThreadIgnorer()

	p.playbookService = app.NewPlaybookService(playbookStore, p.bot, telemetryClient, pluginAPIClient, p.config, keywordsThreadIgnorer)

	api.NewPlaybookHandler(
		p.handler.APIRouter,
		p.playbookService,
		pluginAPIClient,
		p.bot,
		p.config,
	)
	api.NewPlaybookRunHandler(
		p.handler.APIRouter,
		p.playbookRunService,
		p.playbookService,
		pluginAPIClient,
		p.bot,
		p.bot,
		p.config,
	)
	api.NewStatsHandler(p.handler.APIRouter, pluginAPIClient, p.bot, statsStore, p.playbookService)
	api.NewBotHandler(p.handler.APIRouter, pluginAPIClient, p.bot, p.bot, p.config, p.playbookRunService, userInfoStore)
	api.NewTelemetryHandler(p.handler.APIRouter, p.playbookRunService, pluginAPIClient, p.bot, telemetryClient, p.playbookService, telemetryClient, telemetryClient)
	api.NewSignalHandler(p.handler.APIRouter, pluginAPIClient, p.bot, p.playbookRunService, p.playbookService, keywordsThreadIgnorer)
	api.NewSettingsHandler(p.handler.APIRouter, pluginAPIClient, p.bot, p.config)

	isTestingEnabled := false
	flag := p.API.GetConfig().ServiceSettings.EnableTesting
	if flag != nil {
		isTestingEnabled = *flag
	}
	if err = command.RegisterCommands(p.API.RegisterCommand, isTestingEnabled); err != nil {
		return errors.Wrapf(err, "failed register commands")
	}

	// prevent a recursive OnConfigurationChange
	go func() {
		// Remove the prepackaged old versions of the plugin
		_ = pluginAPIClient.Plugin.Remove("com.mattermost.plugin-incident-response")
		_ = pluginAPIClient.Plugin.Remove("com.mattermost.plugin-incident-management")
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
	runner := command.NewCommandRunner(c, args, pluginapi.NewClient(p.API, p.Driver), p.bot, p.bot, p.playbookRunService, p.playbookService, p.config)

	if err := runner.Execute(); err != nil {
		return nil, model.NewAppError("Playbooks.ExecuteCommand", "Unable to execute command.", nil, err.Error(), http.StatusInternalServerError)
	}

	return &model.CommandResponse{}, nil
}

func (p *Plugin) UserHasJoinedChannel(c *plugin.Context, channelMember *model.ChannelMember, actor *model.User) {
	actorID := ""
	if actor != nil && actor.Id != channelMember.UserId {
		actorID = actor.Id
	}
	p.playbookRunService.UserHasJoinedChannel(channelMember.UserId, channelMember.ChannelId, actorID)
}

func (p *Plugin) UserHasLeftChannel(c *plugin.Context, channelMember *model.ChannelMember, actor *model.User) {
	actorID := ""
	if actor != nil && actor.Id != channelMember.UserId {
		actorID = actor.Id
	}
	p.playbookRunService.UserHasLeftChannel(channelMember.UserId, channelMember.ChannelId, actorID)
}

func (p *Plugin) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {
	p.playbookService.MessageHasBeenPosted(c.SessionId, post)
}
