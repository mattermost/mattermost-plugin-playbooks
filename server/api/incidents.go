package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
)

// IncidentHandler is the API handler.
type IncidentHandler struct {
	incidentService incident.Service
	pluginAPI       *pluginapi.Client
	poster          bot.Poster
}

// NewIncidentHandler Creates a new Plugin API handler.
func NewIncidentHandler(router *mux.Router, incidentService incident.Service, api *pluginapi.Client, poster bot.Poster) *IncidentHandler {
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
	incidentRouter.HandleFunc("/end", handler.endIncident).Methods(http.MethodPut)

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
		HandleError(w, errors.New("failed to decode SubmitDialogRequest"))
		return
	}

	name := request.Submission[incident.DialogFieldNameKey].(string)
	newIncident, err := h.incidentService.CreateIncident(&incident.Incident{
		Header: incident.Header{
			CommanderUserID: request.UserId,
			TeamID:          request.TeamId,
			Name:            name,
		},
		PostID: request.State,
	})

	if errors.Is(err, incident.ErrChannelExists) {
		h.poster.Ephemeral(request.UserId, request.ChannelId, "Error: A channel with the name `%v` already exists. Please choose a different name.", name)
		w.WriteHeader(http.StatusOK)
		return
	} else if err != nil {
		HandleError(w, err)
		return
	}

	if err := h.postIncidentCreated(newIncident, request.ChannelId); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) postIncidentCreated(incident *incident.Incident, channelID string) error {
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
	var incidentHeaders []incident.Header
	teamID := r.URL.Query().Get("team_id")

	// Check permissions
	userID := r.Header.Get("Mattermost-User-ID")
	isAdmin := h.pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM)
	if teamID == "" && !isAdmin {
		HandleError(w, fmt.Errorf("userID %s is not an admin", userID))
		return
	}
	if !isAdmin && !h.pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PERMISSION_VIEW_TEAM) {
		HandleError(w, fmt.Errorf("userID %s does not have view permission for teamID %s", userID, teamID))
		return
	}

	filterOptions := incident.HeaderFilterOptions{
		TeamID: teamID,
	}

	incidentHeaders, err := h.incidentService.GetHeaders(filterOptions)
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

func (h *IncidentHandler) endIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	err := h.incidentService.EndIncident(vars["id"], userID)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{\"status\": \"OK\"}"))
}
