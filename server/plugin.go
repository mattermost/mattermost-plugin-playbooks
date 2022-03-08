package main

import (
	"net/http"
	"path/filepath"

	"github.com/mattermost/mattermost-plugin-playbooks/server/api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/command"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-plugin-playbooks/server/enterprise"
	"github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore"
	"github.com/mattermost/mattermost-plugin-playbooks/server/telemetry"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
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

type TelemetryClient interface {
	app.PlaybookRunTelemetry
	app.PlaybookTelemetry
	bot.Telemetry
	app.UserInfoTelemetry
	app.ChannelActionTelemetry
	Enable() error
	Disable() error
}

// Plugin implements the interface expected by the Mattermost server to communicate between the
// server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	handler              *api.Handler
	config               *config.ServiceImpl
	playbookRunService   app.PlaybookRunService
	playbookService      app.PlaybookService
	permissions          *app.PermissionsService
	channelActionService app.ChannelActionService
	bot                  *bot.Bot
	pluginAPI            *pluginapi.Client
	userInfoStore        app.UserInfoStore
	telemetryClient      TelemetryClient
	licenseChecker       app.LicenseChecker
}

// ServeHTTP routes incoming HTTP requests to the plugin's REST API.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.handler.ServeHTTP(w, r)
}

// OnActivate Called when this plugin is activated.
func (p *Plugin) OnActivate() error {
	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		return errors.Wrapf(err, "unable to get bundle path")
	}

	if err := i18n.TranslationsPreInit(filepath.Join(bundlePath, "assets/i18n")); err != nil {
		return errors.Wrapf(err, "unable to load translation files")
	}

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

	if rudderDataplaneURL == "" || rudderWriteKey == "" {
		pluginAPIClient.Log.Warn("Rudder credentials are not set. Disabling analytics.")
		p.telemetryClient = &telemetry.NoopTelemetry{}
	} else {
		diagnosticID := pluginAPIClient.System.GetDiagnosticID()
		serverVersion := pluginAPIClient.System.GetServerVersion()
		p.telemetryClient, err = telemetry.NewRudder(rudderDataplaneURL, rudderWriteKey, diagnosticID, manifest.Version, serverVersion)
		if err != nil {
			return errors.Wrapf(err, "failed init telemetry client")
		}
	}

	toggleTelemetry := func() {
		diagnosticsFlag := pluginAPIClient.Configuration.GetConfig().LogSettings.EnableDiagnostics
		telemetryEnabled := diagnosticsFlag != nil && *diagnosticsFlag

		if telemetryEnabled {
			if err = p.telemetryClient.Enable(); err != nil {
				pluginAPIClient.Log.Warn("Telemetry could not be enabled", "Error", err)
			}
			return
		}

		if err = p.telemetryClient.Disable(); err != nil {
			pluginAPIClient.Log.Error("Telemetry could not be disabled", "Error", err)
		}
	}

	toggleTelemetry()
	p.config.RegisterConfigChangeListener(toggleTelemetry)

	apiClient := sqlstore.NewClient(pluginAPIClient)
	p.bot = bot.New(pluginAPIClient, p.config.GetConfiguration().BotUserID, p.config, p.telemetryClient)
	scheduler := cluster.GetJobOnceScheduler(p.API)

	sqlStore, err := sqlstore.New(apiClient, p.bot, scheduler)
	if err != nil {
		return errors.Wrapf(err, "failed creating the SQL store")
	}

	playbookRunStore := sqlstore.NewPlaybookRunStore(apiClient, p.bot, sqlStore)
	playbookStore := sqlstore.NewPlaybookStore(apiClient, p.bot, sqlStore)
	statsStore := sqlstore.NewStatsStore(apiClient, p.bot, sqlStore)
	p.userInfoStore = sqlstore.NewUserInfoStore(sqlStore)
	channelActionStore := sqlstore.NewChannelActionStore(apiClient, p.bot, sqlStore)
	p.channelActionService = app.NewChannelActionsService(pluginAPIClient, p.bot, p.bot, channelActionStore, p.telemetryClient)

	p.handler = api.NewHandler(pluginAPIClient, p.config, p.bot)

	keywordsThreadIgnorer := app.NewKeywordsThreadIgnorer()
	p.playbookService = app.NewPlaybookService(playbookStore, p.bot, p.telemetryClient, pluginAPIClient, p.config, keywordsThreadIgnorer)

	p.licenseChecker = enterprise.NewLicenseChecker(pluginAPIClient)

	p.playbookRunService = app.NewPlaybookRunService(
		pluginAPIClient,
		playbookRunStore,
		p.bot,
		p.bot,
		p.config,
		scheduler,
		p.telemetryClient,
		p.API,
		p.playbookService,
		p.channelActionService,
		p.licenseChecker,
	)

	if err = scheduler.SetCallback(p.playbookRunService.HandleReminder); err != nil {
		pluginAPIClient.Log.Error("JobOnceScheduler could not add the playbookRunService's HandleReminder", "error", err.Error())
	}
	if err = scheduler.Start(); err != nil {
		pluginAPIClient.Log.Error("JobOnceScheduler could not start", "error", err.Error())
	}

	// Migrations use the scheduler, so they have to be run after playbookRunService and scheduler have started
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

	p.permissions = app.NewPermissionsService(p.playbookService, p.playbookRunService, pluginAPIClient, p.config, p.licenseChecker)

	api.NewPlaybookHandler(
		p.handler.APIRouter,
		p.playbookService,
		pluginAPIClient,
		p.bot,
		p.config,
		p.permissions,
	)
	api.NewPlaybookRunHandler(
		p.handler.APIRouter,
		p.playbookRunService,
		p.playbookService,
		p.permissions,
		p.licenseChecker,
		pluginAPIClient,
		p.bot,
		p.bot,
		p.config,
	)
	api.NewStatsHandler(p.handler.APIRouter, pluginAPIClient, p.bot, statsStore, p.playbookService, p.permissions, p.licenseChecker)
	api.NewBotHandler(p.handler.APIRouter, pluginAPIClient, p.bot, p.bot, p.config, p.playbookRunService, p.userInfoStore)
	api.NewTelemetryHandler(p.handler.APIRouter, p.playbookRunService, pluginAPIClient, p.bot, p.telemetryClient, p.playbookService, p.telemetryClient, p.telemetryClient, p.permissions)
	api.NewSignalHandler(p.handler.APIRouter, pluginAPIClient, p.bot, p.playbookRunService, p.playbookService, keywordsThreadIgnorer)
	api.NewSettingsHandler(p.handler.APIRouter, pluginAPIClient, p.bot, p.config)
	api.NewActionsHandler(p.handler.APIRouter, p.bot, p.channelActionService, p.pluginAPI, p.permissions)

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
	runner := command.NewCommandRunner(c, args, pluginapi.NewClient(p.API, p.Driver), p.bot, p.bot,
		p.playbookRunService, p.playbookService, p.config, p.userInfoStore, p.telemetryClient, p.permissions)

	if err := runner.Execute(); err != nil {
		return nil, model.NewAppError("Playbooks.ExecuteCommand", "app.command.execute.error", nil, err.Error(), http.StatusInternalServerError)
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
