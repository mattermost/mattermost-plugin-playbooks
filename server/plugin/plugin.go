package plugin

import (
	"net/http"

	"github.com/mattermost/mattermost-plugin-incident-response/server/api"
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
	config          config.Service
	incidentService incident.Service
}

// ServeHTTP demonstrates a plugin that handles HTTP requests by greeting the world.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.handler.ServeHTTP(w, r, c.SourcePluginId)
}

func (p *Plugin) OnActivate() error {
	p.config = config.NewService(p.API)

	botID, err := p.Helpers.EnsureBot(&model.Bot{
		Username:    "incident",
		DisplayName: "Incident",
		Description: "A prototype demonstrating incident response management in Mattermost.",
	})
	if err != nil {
		return errors.Wrap(err, "failed to ensure workflow bot")
	}
	err = p.config.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
	})
	if err != nil {
		return errors.Wrap(err, "failed save bot to config")
	}

	p.handler = api.NewHandler()
	p.incidentService = incident.NewService(p.API, p.Helpers)
	incident.NewHandler(p.handler.APIRouter, p.incidentService)

	p.API.LogDebug("Incident response plugin Activated")
	return nil
}
