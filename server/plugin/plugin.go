package plugin

import (
	"net/http"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

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
	configService   config.Service
	incidentService incident.Service
	logger          bot.Service
}

// ServeHTTP demonstrates a plugin that handles HTTP requests by greeting the world.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.handler.ServeHTTP(w, r, c.SourcePluginId)
}

// OnActivate Called when this plugin is activated.
func (p *Plugin) OnActivate() error {
	p.configService = config.NewService(p.API)

	botID, err := p.Helpers.EnsureBot(&model.Bot{
		Username:    "incident",
		DisplayName: "Incident Bot",
		Description: "A prototype demonstrating incident response management in Mattermost.",
	})
	if err != nil {
		return errors.Wrap(err, "failed to ensure workflow bot")
	}
	err = p.configService.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
		c.AdminLogLevel = "debug"
	})
	if err != nil {
		return errors.Wrap(err, "failed save bot to config")
	}

	p.handler = api.NewHandler()
	p.logger = bot.New(p.API, p.configService.GetConfiguration().BotUserID, p.configService)
	p.incidentService = incident.NewService(pluginapi.NewClient(p.API), p.logger, p.configService)
	incident.NewHandler(p.handler.APIRouter, p.incidentService)

	if err := incident.RegisterCommands(p.API.RegisterCommand); err != nil {
		return errors.Wrap(err, "failed register commands")
	}

	p.API.LogDebug("Incident response plugin Activated")
	return nil
}

// ExecuteCommand executes a command that has been previously registered via the RegisterCommand.
func (p *Plugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	runner := incident.NewCommandRunner(c, args, pluginapi.NewClient(p.API), p.Helpers, p.logger, p.incidentService)

	if err := runner.Execute(); err != nil {
		return nil, model.NewAppError("workflowplugin.ExecuteCommand", "Unable to execute command.", nil, err.Error(), http.StatusInternalServerError)
	}

	return &model.CommandResponse{}, nil
}
