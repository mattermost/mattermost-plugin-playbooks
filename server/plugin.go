package main

import (
	"net/http"

	pluginApi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"

	"github.com/mattermost/mattermost-plugin-incident-response/server/api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/pkg/errors"
)

// Plugin implements the interface expected by the Mattermost server to communicate between the server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	handler         *api.Handler
	config          *config.Config
	incidentService *incident.Service
	bot             *bot.Bot
}

// ServeHTTP demonstrates a plugin that handles HTTP requests by greeting the world.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.handler.ServeHTTP(w, r, c.SourcePluginId)
}

// OnActivate Called when this plugin is activated.
func (p *Plugin) OnActivate() error {
	pluginAPIClient := pluginApi.NewClient(p.API)
	p.config = config.NewConfig(pluginAPIClient)

	botID, err := pluginAPIClient.Bot.EnsureBot(&model.Bot{
		Username:    "incident",
		DisplayName: "Incident Bot",
		Description: "A prototype demonstrating incident response management in Mattermost.",
	})
	if err != nil {
		return errors.Wrap(err, "failed to ensure workflow bot")
	}
	err = p.config.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
		c.AdminLogLevel = "debug"
	})
	if err != nil {
		return errors.Wrap(err, "failed save bot to config")
	}

	p.handler = api.NewHandler()
	p.bot = bot.New(pluginAPIClient, p.config.GetConfiguration().BotUserID, p.config)
	p.incidentService = incident.NewService(
		pluginAPIClient,
		pluginkvstore.NewStore(pluginAPIClient),
		p.bot,
		p.config,
	)

	api.NewIncidentHandler(p.handler.APIRouter, p.incidentService)

	if err := RegisterCommands(p.API.RegisterCommand); err != nil {
		return errors.Wrap(err, "failed register commands")
	}

	p.API.LogDebug("Incident response plugin Activated")
	return nil
}

// ExecuteCommand executes a command that has been previously registered via the RegisterCommand.
func (p *Plugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	runner := NewCommandRunner(c, args, pluginApi.NewClient(p.API), p.bot, p.bot, p.incidentService)

	if err := runner.Execute(); err != nil {
		return nil, model.NewAppError("workflowplugin.ExecuteCommand", "Unable to execute command.", nil, err.Error(), http.StatusInternalServerError)
	}

	return &model.CommandResponse{}, nil
}
