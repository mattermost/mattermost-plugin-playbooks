package main

import (
	"fmt"
	"net/http"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/command"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"
	"github.com/mattermost/mattermost-plugin-incident-response/server/telemetry"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
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

// ServeHTTP demonstrates a plugin that handles HTTP requests by greeting the world.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.handler.ServeHTTP(w, r, c.SourcePluginId)
}

// OnActivate Called when this plugin is activated.
func (p *Plugin) OnActivate() error {
	pluginAPIClient := pluginapi.NewClient(p.API)
	p.config = config.NewConfigService(pluginAPIClient)

	botID, err := pluginAPIClient.Bot.EnsureBot(&model.Bot{
		Username:    "incident",
		DisplayName: "Incident Bot",
		Description: "A prototype demonstrating incident response management in Mattermost.",
	})
	if err != nil {
		return fmt.Errorf("failed to ensure workflow bot: %w", err)
	}
	err = p.config.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
		c.AdminLogLevel = "debug"
	})
	if err != nil {
		return fmt.Errorf("failed save bot to config: %w", err)
	}

	var telemetryClient incident.Telemetry
	if rudderDataplaneURL == "" || rudderWriteKey == "" {
		pluginAPIClient.Log.Warn("Rudder credentials are not set. Disabling analytics.")
		telemetryClient = &telemetry.NoopTelemetry{}
	} else {
		diagnosticID := pluginAPIClient.System.GetDiagnosticID()
		telemetryClient, err = telemetry.NewRudder(rudderDataplaneURL, rudderWriteKey, diagnosticID)
		if err != nil {
			return fmt.Errorf("failed init telemetry client: %w", err)
		}
	}

	p.handler = api.NewHandler()
	p.bot = bot.New(pluginAPIClient, p.config.GetConfiguration().BotUserID, p.config)
	p.incidentService = incident.NewService(
		pluginAPIClient,
		pluginkvstore.NewIncidentStore(pluginAPIClient),
		p.bot,
		p.config,
		telemetryClient,
	)
	api.NewIncidentHandler(p.handler.APIRouter, p.incidentService, pluginAPIClient, p.bot)
	p.playbookService = playbook.NewService(pluginkvstore.NewPlaybookStore(&pluginAPIClient.KV))
	api.NewPlaybookHandler(p.handler.APIRouter, p.playbookService)

	if err := command.RegisterCommands(p.API.RegisterCommand); err != nil {
		return fmt.Errorf("failed register commands: %w", err)
	}

	p.API.LogDebug("Incident response plugin Activated")
	return nil
}

// ExecuteCommand executes a command that has been previously registered via the RegisterCommand.
func (p *Plugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	runner := command.NewCommandRunner(c, args, pluginapi.NewClient(p.API), p.bot, p.bot, p.incidentService, p.playbookService)

	if err := runner.Execute(); err != nil {
		return nil, model.NewAppError("workflowplugin.ExecuteCommand", "Unable to execute command.", nil, err.Error(), http.StatusInternalServerError)
	}

	return &model.CommandResponse{}, nil
}
