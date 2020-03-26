package incident

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-response/server/api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/pkg/errors"
)

// Handler Plugin API handler.
type Handler struct {
	incidentService Service
	pluginAPI       *pluginapi.Client
	poster          bot.Poster
}

// NewHandler Creates a new Plugin API handler.
func NewHandler(router *mux.Router, incidentService Service, api *pluginapi.Client, poster bot.Poster) *Handler {
	handler := &Handler{
		incidentService: incidentService,
		pluginAPI:       api,
		poster:          poster,
	}

	incidentsRouter := router.PathPrefix("/incidents").Subrouter()
	incidentsRouter.HandleFunc("", handler.createIncident).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("", handler.getIncidents).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/dialog", handler.createIncidentFromDialog).Methods(http.MethodPost)

	incidentRouter := incidentsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	incidentRouter.HandleFunc("", handler.getIncident).Methods(http.MethodGet)

	return handler
}

func (h *Handler) createIncident(w http.ResponseWriter, r *http.Request) {
	_, err := h.incidentService.CreateIncident(nil)
	if err != nil {
		api.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) createIncidentFromDialog(w http.ResponseWriter, r *http.Request) {
	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		api.HandleError(w, errors.New("failed to decode SubmitDialogRequest"))
		return
	}

	incident, err := h.incidentService.CreateIncident(&Incident{
		Header: Header{
			CommanderUserID: request.UserId,
			TeamID:          request.TeamId,
			Name:            request.Submission[dialogFieldNameKey].(string),
		},
		PostID: request.State,
	})

	if err != nil {
		api.HandleError(w, err)
		return
	}

	if err := h.postIncidentCreated(incident, request.ChannelId); err != nil {
		api.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) postIncidentCreated(incident *Incident, channelID string) error {
	team, err := h.pluginAPI.Team.Get(incident.TeamID)
	if err != nil {
		return err
	}

	channel, err := h.pluginAPI.Channel.Get(incident.ChannelIDs[0])
	if err != nil {
		return err
	}

	url := h.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	msg := fmt.Sprintf("Incident started -> [~%s](%s)", incident.Name, fmt.Sprintf("%s/%s/channels/%s", *url, team.Name, channel.Name))
	h.poster.Ephemeral(incident.CommanderUserID, channelID, "%s", msg)

	return nil
}

func (h *Handler) getIncidents(w http.ResponseWriter, r *http.Request) {
	incidentHeaders, err := h.incidentService.GetAllHeaders()
	if err != nil {
		api.HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(incidentHeaders)
	if err != nil {
		api.HandleError(w, err)
		return
	}

	if _, err = w.Write(jsonBytes); err != nil {
		api.HandleError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) getIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incident, err := h.incidentService.GetIncident(vars["id"])
	if err != nil {
		api.HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(incident)
	if err != nil {
		api.HandleError(w, err)
		return
	}

	if _, err = w.Write(jsonBytes); err != nil {
		api.HandleError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}
