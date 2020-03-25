package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/pkg/errors"
)

// IncidentHandler is the API handler.
type IncidentHandler struct {
	incidentService IncidentService
	pluginAPI       *pluginapi.Client
	poster          bot.Poster
}

// IncidentService defines the methods we need from the incident.Service
type IncidentService interface {
	// CreateIncident Creates a new incident.
	CreateIncident(incident *incident.Incident) (*incident.Incident, error)

	// GetAllHeaders returns the headers for all incidents.
	GetAllHeaders() ([]incident.Header, error)

	// GetIncident Gets an incident by ID.
	GetIncident(id string) (*incident.Incident, error)
}

// NewIncidentHandler Creates a new Plugin API handler.
func NewIncidentHandler(router *mux.Router, incidentService IncidentService) *IncidentHandler {
	handler := &IncidentHandler{
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

func (h *IncidentHandler) createIncident(w http.ResponseWriter, r *http.Request) {
	_, err := h.incidentService.CreateIncident(nil)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) createIncidentFromDialog(w http.ResponseWriter, r *http.Request) {
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

func (h *IncidentHandler) postIncidentCreated(incident *Incident, channelID string) error {
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

func (h *IncidentHandler) getIncidents(w http.ResponseWriter, r *http.Request) {
	incidentHeaders, err := h.incidentService.GetAllHeaders()
	if err != nil {
		HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(incidentHeaders)
	if err != nil {
		HandleError(w, err)
		return
	}

	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) getIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incident, err := h.incidentService.GetIncident(vars["id"])
	if err != nil {
		HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(incident)
	if err != nil {
		HandleError(w, err)
		return
	}

	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}
