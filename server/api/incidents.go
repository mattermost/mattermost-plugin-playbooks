package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-management/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-management/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-management/server/permissions"
	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"
)

// IncidentHandler is the API handler.
type IncidentHandler struct {
	incidentService incident.Service
	playbookService playbook.Service
	pluginAPI       *pluginapi.Client
	poster          bot.Poster
	log             bot.Logger
}

// NewIncidentHandler Creates a new Plugin API handler.
func NewIncidentHandler(router *mux.Router, incidentService incident.Service, playbookService playbook.Service,
	api *pluginapi.Client, poster bot.Poster, log bot.Logger) *IncidentHandler {
	handler := &IncidentHandler{
		incidentService: incidentService,
		playbookService: playbookService,
		pluginAPI:       api,
		poster:          poster,
		log:             log,
	}

	incidentsRouter := router.PathPrefix("/incidents").Subrouter()
	incidentsRouter.HandleFunc("", handler.getIncidents).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("", handler.createIncidentFromPost).Methods(http.MethodPost)

	incidentsRouter.HandleFunc("/dialog", handler.createIncidentFromDialog).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("/commanders", handler.getCommanders).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/channels", handler.getChannels).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/checklist-autocomplete", handler.getChecklistAutocomplete).Methods(http.MethodGet)

	incidentRouter := incidentsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	incidentRouter.HandleFunc("", handler.getIncident).Methods(http.MethodGet)
	incidentRouter.HandleFunc("/metadata", handler.getIncidentMetadata).Methods(http.MethodGet)

	incidentRouterAuthorized := incidentRouter.PathPrefix("").Subrouter()
	incidentRouterAuthorized.Use(handler.checkEditPermissions)
	incidentRouterAuthorized.Use(handler.checkChannelArchived)

	incidentRouterAuthorized.HandleFunc("", handler.updateIncident).Methods(http.MethodPatch)
	incidentRouterAuthorized.HandleFunc("/end", handler.endIncident).Methods(http.MethodPut, http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/restart", handler.restartIncident).Methods(http.MethodPut)
	incidentRouterAuthorized.HandleFunc("/commander", handler.changeCommander).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/update-status-dialog", handler.updateStatusDialog).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/reminder/button-update", handler.reminderButtonUpdate).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/reminder/button-dismiss", handler.reminderButtonDismiss).Methods(http.MethodPost)

	channelRouter := incidentsRouter.PathPrefix("/channel").Subrouter()
	channelRouter.HandleFunc("/{channel_id:[A-Za-z0-9]+}", handler.getIncidentByChannel).Methods(http.MethodGet)

	checklistsRouter := incidentRouterAuthorized.PathPrefix("/checklists").Subrouter()
	checklistsRouter.Use(handler.checkChannelArchived)

	checklistRouter := checklistsRouter.PathPrefix("/{checklist:[0-9]+}").Subrouter()
	checklistRouter.HandleFunc("/add", handler.addChecklistItem).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/reorder", handler.reorderChecklist).Methods(http.MethodPut)

	checklistItem := checklistRouter.PathPrefix("/item/{item:[0-9]+}").Subrouter()
	checklistItem.HandleFunc("", handler.itemDelete).Methods(http.MethodDelete)
	checklistItem.HandleFunc("", handler.itemRename).Methods(http.MethodPut)
	checklistItem.HandleFunc("/state", handler.itemSetState).Methods(http.MethodPut)
	checklistItem.HandleFunc("/assignee", handler.itemSetAssignee).Methods(http.MethodPut)
	checklistItem.HandleFunc("/run", handler.itemRun).Methods(http.MethodPost)

	return handler
}

func (h *IncidentHandler) checkEditPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		if err := permissions.EditIncident(userID, vars["id"], h.pluginAPI, h.incidentService); err != nil {
			if errors.Is(err, permissions.ErrNoPermissions) {
				HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err)
				return
			}
			HandleError(w, err)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (h *IncidentHandler) checkChannelArchived(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		incidentID := vars["id"]

		isArchived, err := h.isChannelArchived(incidentID)
		if err != nil {
			HandleError(w, err)
			return
		}

		if isArchived {
			HandleErrorWithCode(w, http.StatusForbidden, "Channel Archived", err)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ChannelActiveRequiredHandler returns a handler which checks if the channel is active and not archived
func (h *IncidentHandler) channelActiveRequiredHandler(next func(w http.ResponseWriter, r *http.Request)) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		incidentID := vars["id"]

		isArchived, err := h.isChannelArchived(incidentID)
		if err != nil {
			HandleError(w, err)
			return
		}

		// return an error if the channel is archived
		if isArchived {
			HandleErrorWithCode(w, http.StatusBadRequest, "Channel is archived and cannot be modified", err)
		}
		next(w, r)
	}
}

func (h *IncidentHandler) isChannelArchived(incidentID string) (bool, error) {
	incidentToModify, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		return false, err
	}

	c, err := h.pluginAPI.Channel.Get(incidentToModify.ChannelID)
	if err != nil {
		return false, err
	}
	return c.DeleteAt > 0, nil
}

// createIncidentFromPost handles the POST /incidents endpoint
func (h *IncidentHandler) createIncidentFromPost(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var payloadIncident incident.Incident
	if err := json.NewDecoder(r.Body).Decode(&payloadIncident); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode incident", err)
		return
	}

	newIncident, err := h.createIncident(payloadIncident, userID)

	if errors.Is(err, incident.ErrPermission) {
		HandleErrorWithCode(w, http.StatusForbidden, "unable to create incident", err)
		return
	}

	if errors.Is(err, incident.ErrMalformedIncident) {
		HandleErrorWithCode(w, http.StatusBadRequest, "unable to create incident", err)
		return
	}

	if err != nil {
		HandleError(w, errors.Wrapf(err, "unable to create incident"))
		return
	}

	h.poster.PublishWebsocketEventToUser(incident.IncidentCreatedWSEvent, map[string]interface{}{
		"incident": newIncident,
	}, userID)

	w.Header().Add("Location", fmt.Sprintf("/api/v0/incidents/%s", newIncident.ID))
	ReturnJSON(w, &newIncident, http.StatusCreated)
}

// Note that this currently does nothing. This is temporary given the removal of stages. Will be used by status.
func (h *IncidentHandler) updateIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	//userID := r.Header.Get("Mattermost-User-ID")

	oldIncident, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	var updates incident.UpdateOptions
	if err = json.NewDecoder(r.Body).Decode(&updates); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	updatedIncident := oldIncident

	ReturnJSON(w, updatedIncident, http.StatusOK)
}

// createIncidentFromDialog handles the interactive dialog submission when a user presses confirm on
// the create incident dialog.
func (h *IncidentHandler) createIncidentFromDialog(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
		return
	}

	if userID != request.UserId {
		HandleErrorWithCode(w, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	var state incident.DialogState
	err := json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal dialog state", err)
		return
	}

	var playbookID, name, description string
	if rawPlaybookID, ok := request.Submission[incident.DialogFieldPlaybookIDKey].(string); ok {
		playbookID = rawPlaybookID
	}
	if rawName, ok := request.Submission[incident.DialogFieldNameKey].(string); ok {
		name = rawName
	}
	if rawDescription, ok := request.Submission[incident.DialogFieldDescriptionKey].(string); ok {
		description = rawDescription
	}

	payloadIncident := incident.Incident{
		CommanderUserID: request.UserId,
		TeamID:          request.TeamId,
		Name:            name,
		Description:     description,
		PostID:          state.PostID,
		PlaybookID:      playbookID,
	}

	newIncident, err := h.createIncident(payloadIncident, request.UserId)
	if err != nil {
		if errors.Is(err, incident.ErrMalformedIncident) {
			HandleErrorWithCode(w, http.StatusBadRequest, "unable to create incident", err)
			return
		}

		var msg string

		if errors.Is(err, incident.ErrChannelDisplayNameInvalid) {
			msg = "The incident name is invalid or too long. Please use a valid name with fewer than 64 characters."
		} else if errors.Is(err, incident.ErrPermission) {
			msg = err.Error()
		}

		if msg != "" {
			resp := &model.SubmitDialogResponse{
				Errors: map[string]string{
					incident.DialogFieldNameKey: msg,
				},
			}
			_, _ = w.Write(resp.ToJson())
			return
		}

		HandleError(w, err)
		return
	}

	h.poster.PublishWebsocketEventToUser(incident.IncidentCreatedWSEvent, map[string]interface{}{
		"client_id": state.ClientID,
		"incident":  newIncident,
	}, request.UserId)

	if err := h.postIncidentCreatedMessage(newIncident, request.ChannelId); err != nil {
		HandleError(w, err)
		return
	}

	w.Header().Add("Location", fmt.Sprintf("/api/v0/incidents/%s", newIncident.ID))
	w.WriteHeader(http.StatusCreated)
}

func (h *IncidentHandler) createIncident(newIncident incident.Incident, userID string) (*incident.Incident, error) {
	if newIncident.ID != "" {
		return nil, errors.Wrap(incident.ErrMalformedIncident, "incident already has an id")
	}

	if newIncident.ChannelID != "" {
		return nil, errors.Wrap(incident.ErrMalformedIncident, "incident channel already has an id")
	}

	if newIncident.CreateAt != 0 {
		return nil, errors.Wrap(incident.ErrMalformedIncident, "incident channel already has created at date")
	}

	if newIncident.EndAt != 0 {
		return nil, errors.Wrap(incident.ErrMalformedIncident, "incident channel already has ended at date")
	}

	if newIncident.TeamID == "" {
		return nil, errors.Wrap(incident.ErrMalformedIncident, "missing team id of incident")
	}

	if newIncident.CommanderUserID == "" {
		return nil, errors.Wrap(incident.ErrMalformedIncident, "missing commander user id of incident")
	}

	// Commander should have permission to the team
	if !permissions.CanViewTeam(newIncident.CommanderUserID, newIncident.TeamID, h.pluginAPI) {
		return nil, errors.Wrap(incident.ErrPermission, "commander user does not have permissions for the team")
	}

	public := true
	if newIncident.PlaybookID != "" {
		pb, err := h.playbookService.Get(newIncident.PlaybookID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook")
		}

		if !sliceContains(pb.MemberIDs, userID) {
			return nil, errors.New("userID is not a member of playbook")
		}

		newIncident.Checklists = pb.Checklists
		public = pb.CreatePublicIncident

		newIncident.BroadcastChannelID = pb.BroadcastChannelID
		newIncident.ReminderMessageTemplate = pb.ReminderMessageTemplate
		newIncident.PreviousReminder = time.Duration(pb.ReminderTimerDefaultSeconds) * time.Second
	}

	permission := model.PERMISSION_CREATE_PRIVATE_CHANNEL
	permissionMessage := "You are not able to create a private channel"
	if public {
		permission = model.PERMISSION_CREATE_PUBLIC_CHANNEL
		permissionMessage = "You are not able to create a public channel"
	}
	if !h.pluginAPI.User.HasPermissionToTeam(userID, newIncident.TeamID, permission) {
		return nil, errors.Wrap(incident.ErrPermission, permissionMessage)
	}

	if newIncident.PostID != "" {
		post, err := h.pluginAPI.Post.GetPost(newIncident.PostID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get incident original post")
		}
		if !permissions.MemberOfChannelID(userID, post.ChannelId, h.pluginAPI) {
			return nil, errors.New("user is not a member of the channel containing the incident's original post")
		}
	}
	return h.incidentService.CreateIncident(&newIncident, userID, public)
}

// getIncidents handles the GET /incidents endpoint.
func (h *IncidentHandler) getIncidents(w http.ResponseWriter, r *http.Request) {
	filterOptions, err := parseIncidentsFilterOptions(r.URL)
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if !permissions.CanViewTeam(userID, filterOptions.TeamID, h.pluginAPI) {
		HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s", userID, filterOptions.TeamID))
		return
	}

	requesterInfo := incident.RequesterInfo{
		UserID:          userID,
		UserIDtoIsAdmin: map[string]bool{userID: permissions.IsAdmin(userID, h.pluginAPI)},
	}

	results, err := h.incidentService.GetIncidents(requesterInfo, *filterOptions)
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, results, http.StatusOK)
}

// getIncident handles the /incidents/{id} endpoint.
func (h *IncidentHandler) getIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := permissions.ViewIncident(userID, incidentID, h.pluginAPI, h.incidentService); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "User doesn't have permissions to incident.", nil)
		return
	}

	incidentToGet, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, incidentToGet, http.StatusOK)
}

// getIncidentMetadata handles the /incidents/{id}/metadata endpoint.
func (h *IncidentHandler) getIncidentMetadata(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := permissions.ViewIncident(userID, incidentID, h.pluginAPI, h.incidentService); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized",
			errors.Errorf("userid: %s does not have permissions to view the incident details", userID))
		return
	}

	incidentToGet, err := h.incidentService.GetIncidentMetadata(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, incidentToGet, http.StatusOK)
}

// getIncidentByChannel handles the /incidents/channel/{channel_id} endpoint.
func (h *IncidentHandler) getIncidentByChannel(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := permissions.ViewIncidentFromChannelID(userID, channelID, h.pluginAPI, h.incidentService); err != nil {
		h.log.Warnf("User %s does not have permissions to get incident for channel %s", userID, channelID)
		HandleErrorWithCode(w, http.StatusNotFound, "Not found",
			errors.Errorf("incident for channel id %s not found", channelID))
		return
	}

	incidentID, err := h.incidentService.GetIncidentIDForChannel(channelID)
	if err != nil {
		if errors.Is(err, incident.ErrNotFound) {
			HandleErrorWithCode(w, http.StatusNotFound, "Not found",
				errors.Errorf("incident for channel id %s not found", channelID))

			return
		}
		HandleError(w, err)
		return
	}

	incidentToGet, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, incidentToGet, http.StatusOK)
}

// endIncident handles the /incidents/{id}/end api endpoint.
//
// In addition to being reachable directly via the REST API, the POST version of this endpoint is
// also used as the target of the interactive dialog spawned by `/incident end`.
func (h *IncidentHandler) endIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	err := h.incidentService.EndIncident(incidentID, userID)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// restartIncident handles the /incidents/{id}/restart api endpoint.
func (h *IncidentHandler) restartIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	err := h.incidentService.RestartIncident(vars["id"], userID)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// getCommanders handles the /incidents/commanders api endpoint.
func (h *IncidentHandler) getCommanders(w http.ResponseWriter, r *http.Request) {
	teamID := r.URL.Query().Get("team_id")
	if teamID == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter: team_id", errors.New("team_id required"))
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if !permissions.CanViewTeam(userID, teamID, h.pluginAPI) {
		HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s",
			userID,
			teamID,
		))
		return
	}

	options := incident.HeaderFilterOptions{
		TeamID: teamID,
	}

	requesterInfo := incident.RequesterInfo{
		UserID:          userID,
		UserIDtoIsAdmin: map[string]bool{userID: permissions.IsAdmin(userID, h.pluginAPI)},
	}

	commanders, err := h.incidentService.GetCommanders(requesterInfo, options)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "failed to get commanders"))
		return
	}

	if commanders == nil {
		commanders = []incident.CommanderInfo{}
	}

	ReturnJSON(w, commanders, http.StatusOK)
}

func (h *IncidentHandler) getChannels(w http.ResponseWriter, r *http.Request) {
	filterOptions, err := parseIncidentsFilterOptions(r.URL)
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if !permissions.CanViewTeam(userID, filterOptions.TeamID, h.pluginAPI) {
		HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s",
			userID,
			filterOptions.TeamID,
		))
		return
	}

	requesterInfo := incident.RequesterInfo{
		UserID:          userID,
		UserIDtoIsAdmin: map[string]bool{userID: permissions.IsAdmin(userID, h.pluginAPI)},
	}

	incidents, err := h.incidentService.GetIncidents(requesterInfo, *filterOptions)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "failed to get commanders"))
		return
	}

	channelIds := make([]string, 0, len(incidents.Items))
	for _, incident := range incidents.Items {
		channelIds = append(channelIds, incident.ChannelID)
	}

	ReturnJSON(w, channelIds, http.StatusOK)
}

// changeCommander handles the /incidents/{id}/change-commander api endpoint.
func (h *IncidentHandler) changeCommander(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		CommanderID string `json:"commander_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "could not decode request body", err)
		return
	}

	// Check if the target user (params.CommanderID) has permissions
	if err := permissions.EditIncident(params.CommanderID, vars["id"], h.pluginAPI, h.incidentService); err != nil {
		if errors.Is(err, permissions.ErrNoPermissions) {
			HandleErrorWithCode(w, http.StatusForbidden, "Not authorized",
				errors.Errorf("userid: %s does not have permissions to incident channel; cannot be made commander", params.CommanderID))
			return
		}
		HandleError(w, err)
		return
	}

	if err := h.incidentService.ChangeCommander(vars["id"], userID, params.CommanderID); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// updateStatusDialog handles the POST /incidents/{id}/update-status-dialog endpoint, called when a
// user submits the Update Status dialog.
func (h *IncidentHandler) updateStatusDialog(w http.ResponseWriter, r *http.Request) {
	incidentID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	incidentToModify, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	if !permissions.CanPostToChannel(userID, incidentToModify.ChannelID, h.pluginAPI) {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", fmt.Errorf("user %s cannot post to incident channel %s", userID, incidentToModify.ChannelID))
		return
	}

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
		return
	}

	var options incident.StatusUpdateOptions
	options.Message = request.Submission[incident.DialogFieldMessageKey].(string)
	if reminder, err2 := strconv.Atoi(request.Submission[incident.DialogFieldReminderInSecondsKey].(string)); err2 == nil {
		options.Reminder = time.Duration(reminder) * time.Second
	}

	err = h.incidentService.UpdateStatus(incidentID, userID, options)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// reminderButtonUpdate handles the POST /incidents/{id}/reminder/button-update endpoint, called when a
// user clicks on the reminder interactive button
func (h *IncidentHandler) reminderButtonUpdate(w http.ResponseWriter, r *http.Request) {
	requestData := model.PostActionIntegrationRequestFromJson(r.Body)
	if requestData == nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "missing request data", nil)
		return
	}

	incidentID, err := h.incidentService.GetIncidentIDForChannel(requestData.ChannelId)
	if err != nil {
		HandleErrorWithCode(w, http.StatusInternalServerError, "error getting incident",
			errors.Wrapf(err, "reminderButtonUpdate failed to find incidentID for channelID: %s", requestData.ChannelId))
		return
	}

	if err = permissions.EditIncident(requestData.UserId, incidentID, h.pluginAPI, h.incidentService); err != nil {
		if errors.Is(err, permissions.ErrNoPermissions) {
			ReturnJSON(w, nil, http.StatusForbidden)
			return
		}
		HandleErrorWithCode(w, http.StatusInternalServerError, "error getting permissions", err)
		return
	}

	if err = h.incidentService.OpenUpdateStatusDialog(incidentID, requestData.TriggerId); err != nil {
		HandleError(w, errors.New("reminderButtonUpdate failed to open update status dialog"))
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// reminderButtonDismiss handles the POST /incidents/{id}/reminder/button-dismiss endpoint, called when a
// user clicks on the reminder interactive button
func (h *IncidentHandler) reminderButtonDismiss(w http.ResponseWriter, r *http.Request) {
	requestData := model.PostActionIntegrationRequestFromJson(r.Body)
	if requestData == nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "missing request data", nil)
		return
	}

	incidentID, err := h.incidentService.GetIncidentIDForChannel(requestData.ChannelId)
	if err != nil {
		h.log.Errorf("reminderButtonDismiss: no incident for requestData's channelID: %s", requestData.ChannelId)
		HandleErrorWithCode(w, http.StatusBadRequest, "no incident for requestData's channelID", err)
		return
	}

	if err = permissions.EditIncident(requestData.UserId, incidentID, h.pluginAPI, h.incidentService); err != nil {
		if errors.Is(err, permissions.ErrNoPermissions) {
			ReturnJSON(w, nil, http.StatusForbidden)
			return
		}
		HandleErrorWithCode(w, http.StatusInternalServerError, "error getting permissions", err)
		return
	}

	if err = h.incidentService.RemoveReminderPost(incidentID); err != nil {
		h.log.Errorf("reminderButtonDismiss: error removing reminder for channelID: %s; error: %s", requestData.ChannelId, err.Error())
		HandleErrorWithCode(w, http.StatusBadRequest, "error removing reminder", err)
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// getChecklistAutocomplete handles the GET /incidents/checklists-autocomplete api endpoint
func (h *IncidentHandler) getChecklistAutocomplete(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	incidentID, err := h.incidentService.GetIncidentIDForChannel(channelID)
	if err != nil {
		HandleError(w, err)
		return
	}

	if err = permissions.ViewIncident(userID, incidentID, h.pluginAPI, h.incidentService); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions", nil)
		return
	}

	data, err := h.incidentService.GetChecklistAutocomplete(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *IncidentHandler) itemSetState(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		NewState string `json:"new_state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if !playbook.IsValidChecklistItemState(params.NewState) {
		HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter new state", nil)
		return
	}

	if err := h.incidentService.ModifyCheckedState(id, userID, params.NewState, checklistNum, itemNum); err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *IncidentHandler) itemSetAssignee(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		AssigneeID string `json:"assignee_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if err := h.incidentService.SetAssignee(id, userID, params.AssigneeID, checklistNum, itemNum); err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *IncidentHandler) itemRun(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	triggerID, err := h.incidentService.RunChecklistItemSlashCommand(incidentID, userID, checklistNum, itemNum)
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{"trigger_id": triggerID}, http.StatusOK)
}

func (h *IncidentHandler) addChecklistItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var checklistItem playbook.ChecklistItem
	if err := json.NewDecoder(r.Body).Decode(&checklistItem); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode ChecklistItem", err)
		return
	}

	checklistItem.Title = strings.TrimSpace(checklistItem.Title)
	if checklistItem.Title == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter: checklist item title",
			errors.New("checklist item title must not be blank"))
		return
	}

	if err := h.incidentService.AddChecklistItem(id, userID, checklistNum, checklistItem); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *IncidentHandler) itemDelete(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.incidentService.RemoveChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *IncidentHandler) itemRename(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Title   string `json:"title"`
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal edit params state", err)
		return
	}

	if err := h.incidentService.RenameChecklistItem(id, userID, checklistNum, itemNum, params.Title, params.Command); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) reorderChecklist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var modificationParams struct {
		ItemNum     int `json:"item_num"`
		NewLocation int `json:"new_location"`
	}
	if err := json.NewDecoder(r.Body).Decode(&modificationParams); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal edit params", err)
		return
	}

	if err := h.incidentService.MoveChecklistItem(id, userID, checklistNum, modificationParams.ItemNum, modificationParams.NewLocation); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) postIncidentCreatedMessage(incdnt *incident.Incident, channelID string) error {
	channel, err := h.pluginAPI.Channel.Get(incdnt.ChannelID)
	if err != nil {
		return err
	}

	post := &model.Post{
		Message: fmt.Sprintf("Incident %s started in ~%s", incdnt.Name, channel.Name),
	}
	h.poster.EphemeralPost(incdnt.CommanderUserID, channelID, post)

	return nil
}

// parseIncidentsFilterOptions is only for parsing. Put validation logic in incident.validateOptions.
func parseIncidentsFilterOptions(u *url.URL) (*incident.HeaderFilterOptions, error) {
	teamID := u.Query().Get("team_id")
	if teamID == "" {
		return nil, errors.New("bad parameter 'team_id'; 'team_id' is required")
	}

	pageParam := u.Query().Get("page")
	if pageParam == "" {
		pageParam = "0"
	}
	page, err := strconv.Atoi(pageParam)
	if err != nil {
		return nil, errors.Wrapf(err, "bad parameter 'page'")
	}

	perPageParam := u.Query().Get("per_page")
	if perPageParam == "" {
		perPageParam = "0"
	}
	perPage, err := strconv.Atoi(perPageParam)
	if err != nil {
		return nil, errors.Wrapf(err, "bad parameter 'per_page'")
	}

	sort := u.Query().Get("sort")
	direction := u.Query().Get("direction")

	statusParam := strings.ToLower(u.Query().Get("status"))
	var status incident.Status
	switch statusParam {
	case "all", "": // default
		status = incident.All
	case "active":
		status = incident.Ongoing
	case "ended":
		status = incident.Ended
	default:
		return nil, errors.Errorf("bad status parameter '%s'", statusParam)
	}

	commanderID := u.Query().Get("commander_user_id")
	searchTerm := u.Query().Get("search_term")

	memberID := u.Query().Get("member_id")

	return &incident.HeaderFilterOptions{
		TeamID:      teamID,
		Page:        page,
		PerPage:     perPage,
		Sort:        sort,
		Direction:   direction,
		Status:      status,
		CommanderID: commanderID,
		SearchTerm:  searchTerm,
		MemberID:    memberID,
	}, nil
}

func sliceContains(strs []string, target string) bool {
	for _, s := range strs {
		if s == target {
			return true
		}
	}
	return false
}
