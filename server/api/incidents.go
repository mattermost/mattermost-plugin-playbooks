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
	"github.com/mattermost/mattermost-plugin-incident-collaboration/client"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/permissions"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
)

// IncidentHandler is the API handler.
type IncidentHandler struct {
	config          config.Service
	incidentService incident.Service
	playbookService playbook.Service
	pluginAPI       *pluginapi.Client
	poster          bot.Poster
	log             bot.Logger
	telemetry       incident.Telemetry
}

// NewIncidentHandler Creates a new Plugin API handler.
func NewIncidentHandler(router *mux.Router, incidentService incident.Service, playbookService playbook.Service,
	api *pluginapi.Client, poster bot.Poster, log bot.Logger, telemetry incident.Telemetry, config config.Service) *IncidentHandler {
	handler := &IncidentHandler{
		incidentService: incidentService,
		playbookService: playbookService,
		pluginAPI:       api,
		poster:          poster,
		log:             log,
		telemetry:       telemetry,
		config:          config,
	}

	e20Middleware := E20LicenseRequired{config}

	incidentsRouter := router.PathPrefix("/incidents").Subrouter()
	incidentsRouter.Use(e20Middleware.Middleware)
	incidentsRouter.HandleFunc("", handler.getIncidents).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("", handler.createIncidentFromPost).Methods(http.MethodPost)

	incidentsRouter.HandleFunc("/dialog", handler.createIncidentFromDialog).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("/add-to-timeline-dialog", handler.addToTimelineDialog).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("/commanders", handler.getCommanders).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/channels", handler.getChannels).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/checklist-autocomplete", handler.getChecklistAutocomplete).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/checklist-autocomplete-item", handler.getChecklistAutocompleteItem).Methods(http.MethodGet)

	incidentRouter := incidentsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	incidentRouter.HandleFunc("", handler.getIncident).Methods(http.MethodGet)
	incidentRouter.HandleFunc("/metadata", handler.getIncidentMetadata).Methods(http.MethodGet)

	incidentRouterAuthorized := incidentRouter.PathPrefix("").Subrouter()
	incidentRouterAuthorized.Use(handler.checkEditPermissions)
	incidentRouterAuthorized.HandleFunc("", handler.updateIncident).Methods(http.MethodPatch)
	incidentRouterAuthorized.HandleFunc("/commander", handler.changeCommander).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/status", handler.status).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/update-status-dialog", handler.updateStatusDialog).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/reminder/button-update", handler.reminderButtonUpdate).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/reminder/button-dismiss", handler.reminderButtonDismiss).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/timeline/{eventID:[A-Za-z0-9]+}", handler.removeTimelineEvent).Methods(http.MethodDelete)

	channelRouter := incidentsRouter.PathPrefix("/channel").Subrouter()
	channelRouter.HandleFunc("/{channel_id:[A-Za-z0-9]+}", handler.getIncidentByChannel).Methods(http.MethodGet)

	checklistsRouter := incidentRouterAuthorized.PathPrefix("/checklists").Subrouter()

	checklistRouter := checklistsRouter.PathPrefix("/{checklist:[0-9]+}").Subrouter()
	checklistRouter.HandleFunc("/add", handler.addChecklistItem).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/reorder", handler.reorderChecklist).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/add-dialog", handler.addChecklistItemDialog).Methods(http.MethodPost)

	checklistItem := checklistRouter.PathPrefix("/item/{item:[0-9]+}").Subrouter()
	checklistItem.HandleFunc("", handler.itemDelete).Methods(http.MethodDelete)
	checklistItem.HandleFunc("", handler.itemEdit).Methods(http.MethodPut)
	checklistItem.HandleFunc("/state", handler.itemSetState).Methods(http.MethodPut)
	checklistItem.HandleFunc("/assignee", handler.itemSetAssignee).Methods(http.MethodPut)
	checklistItem.HandleFunc("/run", handler.itemRun).Methods(http.MethodPost)

	telemetryRouterAuthorized := router.PathPrefix("/telemetry").Subrouter()
	telemetryRouterAuthorized.Use(handler.checkViewPermissions)
	telemetryRouterAuthorized.HandleFunc("/incident/{id:[A-Za-z0-9]+}", handler.telemetryForIncident).Methods(http.MethodPost)

	return handler
}

func (h *IncidentHandler) checkEditPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		incdnt, err := h.incidentService.GetIncident(vars["id"])
		if err != nil {
			HandleError(w, err)
			return
		}

		if err := permissions.EditIncident(userID, incdnt.ChannelID, h.pluginAPI); err != nil {
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

func (h *IncidentHandler) checkViewPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		incdnt, err := h.incidentService.GetIncident(vars["id"])
		if err != nil {
			HandleError(w, err)
			return
		}

		if err := permissions.ViewIncident(userID, incdnt.ChannelID, h.pluginAPI); err != nil {
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

// createIncidentFromPost handles the POST /incidents endpoint
func (h *IncidentHandler) createIncidentFromPost(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var incidentCreateOptions client.IncidentCreateOptions
	if err := json.NewDecoder(r.Body).Decode(&incidentCreateOptions); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode incident create options", err)
		return
	}

	if !permissions.IsOnEnabledTeam(incidentCreateOptions.TeamID, h.config) {
		HandleErrorWithCode(w, http.StatusBadRequest, "not enabled on this team", nil)
		return
	}

	payloadIncident := incident.Incident{
		CommanderUserID: incidentCreateOptions.CommanderUserID,
		TeamID:          incidentCreateOptions.TeamID,
		Name:            incidentCreateOptions.Name,
		Description:     incidentCreateOptions.Description,
		PostID:          incidentCreateOptions.PostID,
		PlaybookID:      incidentCreateOptions.PlaybookID,
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

	if !permissions.IsOnEnabledTeam(request.TeamId, h.config) {
		HandleErrorWithCode(w, http.StatusBadRequest, "not enabled on this team", nil)
		return
	}

	var state incident.DialogState
	err := json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal dialog state", err)
		return
	}

	var playbookID, name string
	if rawPlaybookID, ok := request.Submission[incident.DialogFieldPlaybookIDKey].(string); ok {
		playbookID = rawPlaybookID
	}
	if rawName, ok := request.Submission[incident.DialogFieldNameKey].(string); ok {
		name = rawName
	}

	payloadIncident := incident.Incident{
		CommanderUserID: request.UserId,
		TeamID:          request.TeamId,
		Name:            name,
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

// addToTimelineDialog handles the interactive dialog submission when a user clicks the post action
// menu option "Add to incident timeline".
func (h *IncidentHandler) addToTimelineDialog(w http.ResponseWriter, r *http.Request) {
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

	var incidentID, summary string
	if rawIncidentID, ok := request.Submission[incident.DialogFieldIncidentKey].(string); ok {
		incidentID = rawIncidentID
	}
	if rawSummary, ok := request.Submission[incident.DialogFieldSummary].(string); ok {
		summary = rawSummary
	}

	incdnt, incErr := h.incidentService.GetIncident(incidentID)
	if incErr != nil {
		HandleError(w, incErr)
		return
	}

	if err := permissions.EditIncident(userID, incdnt.ChannelID, h.pluginAPI); err != nil {
		return
	}

	var state incident.DialogStateAddToTimeline
	err := json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal dialog state", err)
		return
	}

	if err = h.incidentService.AddPostToTimeline(incidentID, userID, state.PostID, summary); err != nil {
		HandleError(w, errors.Wrap(err, "failed to add post to timeline"))
		return
	}

	w.WriteHeader(http.StatusOK)
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

	if newIncident.TeamID == "" {
		return nil, errors.Wrap(incident.ErrMalformedIncident, "missing team id of incident")
	}

	if newIncident.CommanderUserID == "" {
		return nil, errors.Wrap(incident.ErrMalformedIncident, "missing commander user id of incident")
	}

	if newIncident.Name == "" {
		return nil, errors.Wrap(incident.ErrMalformedIncident, "missing name of incident")
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
		newIncident.Description = pb.Description
		newIncident.ReminderMessageTemplate = pb.ReminderMessageTemplate
		newIncident.PreviousReminder = time.Duration(pb.ReminderTimerDefaultSeconds) * time.Second

		newIncident.InvitedUserIDs = []string{}
		newIncident.InvitedGroupIDs = []string{}
		if pb.InviteUsersEnabled {
			newIncident.InvitedUserIDs = pb.InvitedUserIDs
			newIncident.InvitedGroupIDs = pb.InvitedGroupIDs
		}

		if pb.DefaultCommanderEnabled {
			newIncident.DefaultCommanderID = pb.DefaultCommanderID
		}

		if pb.AnnouncementChannelEnabled {
			newIncident.AnnouncementChannelID = pb.AnnouncementChannelID
		}

		if pb.WebhookOnCreationEnabled {
			newIncident.WebhookOnCreationURL = pb.WebhookOnCreationURL
		}
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

func (h *IncidentHandler) getRequesterInfo(userID string) (permissions.RequesterInfo, error) {
	return permissions.GetRequesterInfo(userID, h.pluginAPI)
}

// getIncidents handles the GET /incidents endpoint.
func (h *IncidentHandler) getIncidents(w http.ResponseWriter, r *http.Request) {
	filterOptions, err := parseIncidentsFilterOptions(r.URL)
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	// More detailed permissions checked on DB level.
	if !permissions.CanViewTeam(userID, filterOptions.TeamID, h.pluginAPI) {
		HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s", userID, filterOptions.TeamID))
		return
	}

	if !permissions.IsOnEnabledTeam(filterOptions.TeamID, h.config) {
		ReturnJSON(w, map[string]bool{"disabled": true}, http.StatusOK)
		return
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		HandleError(w, err)
		return
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

	incidentToGet, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	if err := permissions.ViewIncident(userID, incidentToGet.ChannelID, h.pluginAPI); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "User doesn't have permissions to incident.", nil)
		return
	}

	ReturnJSON(w, incidentToGet, http.StatusOK)
}

// getIncidentMetadata handles the /incidents/{id}/metadata endpoint.
func (h *IncidentHandler) getIncidentMetadata(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	incidentToGet, incErr := h.incidentService.GetIncident(incidentID)
	if incErr != nil {
		HandleError(w, incErr)
		return
	}

	if err := permissions.ViewIncident(userID, incidentToGet.ChannelID, h.pluginAPI); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized",
			errors.Errorf("userid: %s does not have permissions to view the incident details", userID))
		return
	}

	incidentMetadata, err := h.incidentService.GetIncidentMetadata(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, incidentMetadata, http.StatusOK)
}

// getIncidentByChannel handles the /incidents/channel/{channel_id} endpoint.
func (h *IncidentHandler) getIncidentByChannel(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := permissions.ViewIncidentFromChannelID(userID, channelID, h.pluginAPI); err != nil {
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

	options := incident.FilterOptions{
		TeamID: teamID,
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		HandleError(w, err)
		return
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

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		HandleError(w, err)
		return
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

	incdnt, err := h.incidentService.GetIncident(vars["id"])
	if err != nil {
		HandleError(w, err)
		return
	}

	// Check if the target user (params.CommanderID) has permissions
	if err := permissions.EditIncident(params.CommanderID, incdnt.ChannelID, h.pluginAPI); err != nil {
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

// updateStatusD handles the POST /incidents/{id}/status endpoint, user has edit permissions
func (h *IncidentHandler) status(w http.ResponseWriter, r *http.Request) {
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

	var options incident.StatusUpdateOptions
	if err = json.NewDecoder(r.Body).Decode(&options); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode body into StatusUpdateOptions", err)
		return
	}

	options.Description = strings.TrimSpace(options.Description)
	if options.Description == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "description must not be empty", errors.New("description field empty"))
		return
	}

	options.Message = strings.TrimSpace(options.Message)
	if options.Message == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "message must not be empty", errors.New("message field empty"))
		return
	}

	options.Reminder = options.Reminder * time.Second

	options.Status = strings.TrimSpace(options.Status)
	if options.Status == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "status must not be empty", errors.New("status field empty"))
		return
	}
	switch options.Status {
	case incident.StatusActive:
	case incident.StatusArchived:
	case incident.StatusReported:
	case incident.StatusResolved:
		break
	default:
		HandleErrorWithCode(w, http.StatusBadRequest, "invalid status", nil)
		return
	}

	err = h.incidentService.UpdateStatus(incidentID, userID, options)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
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
	if message, ok := request.Submission[incident.DialogFieldMessageKey]; ok {
		options.Message = strings.TrimSpace(message.(string))
	}
	if options.Message == "" {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"errors": {"%s":"This field is required."}}`, incident.DialogFieldMessageKey)))
		return
	}

	if description, ok := request.Submission[incident.DialogFieldDescriptionKey]; ok {
		options.Description = strings.TrimSpace(description.(string))
	}
	if options.Description == "" {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"errors": {"%s":"This field is required."}}`, incident.DialogFieldDescriptionKey)))
		return
	}

	if reminderI, ok := request.Submission[incident.DialogFieldReminderInSecondsKey]; ok {
		if reminder, err2 := strconv.Atoi(reminderI.(string)); err2 == nil {
			options.Reminder = time.Duration(reminder) * time.Second
		}
	}

	if status, ok := request.Submission[incident.DialogFieldStatusKey]; ok {
		options.Status = status.(string)
	}

	switch options.Status {
	case incident.StatusActive:
	case incident.StatusArchived:
	case incident.StatusReported:
	case incident.StatusResolved:
		break
	default:
		HandleErrorWithCode(w, http.StatusBadRequest, "invalid status", nil)
		return
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

	if err = permissions.EditIncident(requestData.UserId, requestData.ChannelId, h.pluginAPI); err != nil {
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

	if err = permissions.EditIncident(requestData.UserId, requestData.ChannelId, h.pluginAPI); err != nil {
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

// removeTimelineEvent handles the DELETE /incidents/{id}/timeline/{eventID} endpoint.
// User has been authenticated to edit the incident.
func (h *IncidentHandler) removeTimelineEvent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	eventID := vars["eventID"]

	if err := h.incidentService.RemoveTimelineEvent(id, eventID); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *IncidentHandler) getChecklistAutocompleteItem(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	incidentID, err := h.incidentService.GetIncidentIDForChannel(channelID)
	if err != nil {
		HandleError(w, err)
		return
	}

	if err = permissions.ViewIncident(userID, incidentID, h.pluginAPI); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions", err)
		return
	}

	data, err := h.incidentService.GetChecklistItemAutocomplete(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *IncidentHandler) getChecklistAutocomplete(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	incidentID, err := h.incidentService.GetIncidentIDForChannel(channelID)
	if err != nil {
		HandleError(w, err)
		return
	}

	if err = permissions.ViewIncident(userID, channelID, h.pluginAPI); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions", err)
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

// addChecklistItemDialog handles the interactive dialog submission when a user clicks add new task
func (h *IncidentHandler) addChecklistItemDialog(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	vars := mux.Vars(r)
	incidentID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
		return
	}

	if userID != request.UserId {
		HandleErrorWithCode(w, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	var name, description string
	if rawName, ok := request.Submission[incident.DialogFieldItemNameKey].(string); ok {
		name = rawName
	}
	if rawDescription, ok := request.Submission[incident.DialogFieldItemDescriptionKey].(string); ok {
		description = rawDescription
	}

	checklistItem := playbook.ChecklistItem{
		Title:       name,
		Description: description,
	}

	checklistItem.Title = strings.TrimSpace(checklistItem.Title)
	if checklistItem.Title == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter: checklist item title",
			errors.New("checklist item title must not be blank"))
		return
	}

	if err := h.incidentService.AddChecklistItem(incidentID, userID, checklistNum, checklistItem); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)

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

func (h *IncidentHandler) itemEdit(w http.ResponseWriter, r *http.Request) {
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
		Title       string `json:"title"`
		Command     string `json:"command"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal edit params state", err)
		return
	}

	if err := h.incidentService.EditChecklistItem(id, userID, checklistNum, itemNum, params.Title, params.Command, params.Description); err != nil {
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

// telemetryForIncident handles the /telemetry/incident/{id}?action=the_action endpoint. The frontend
// can use this endpoint to track events that occur in the context of an incident
func (h *IncidentHandler) telemetryForIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode post body", err)
		return
	}

	if params.Action == "" {
		HandleError(w, errors.New("must provide action"))
		return
	}

	incdnt, err := h.incidentService.GetIncident(id)
	if err != nil {
		HandleError(w, err)
		return
	}

	h.telemetry.FrontendTelemetryForIncident(incdnt, userID, params.Action)

	w.WriteHeader(http.StatusNoContent)
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
func parseIncidentsFilterOptions(u *url.URL) (*incident.FilterOptions, error) {
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

	status := u.Query().Get("status")

	commanderID := u.Query().Get("commander_user_id")
	searchTerm := u.Query().Get("search_term")

	memberID := u.Query().Get("member_id")

	return &incident.FilterOptions{
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
