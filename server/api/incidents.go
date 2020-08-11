package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/permissions"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
)

type listIncidentResult struct {
	listResult
	Items []incident.Incident `json:"items"`
}

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
	incidentsRouter.HandleFunc("/end-dialog", handler.endIncidentFromDialog).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("/commanders", handler.getCommanders).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/channels", handler.getChannels).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/checklist-autocomplete", handler.getChecklistAutocomplete).Methods(http.MethodGet)

	incidentRouter := incidentsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	incidentRouter.HandleFunc("", handler.getIncident).Methods(http.MethodGet)
	incidentRouter.HandleFunc("/details", handler.getIncidentWithDetails).Methods(http.MethodGet)

	incidentRouterAuthorized := incidentRouter.PathPrefix("").Subrouter()
	incidentRouterAuthorized.Use(handler.checkEditPermissions)
	incidentRouterAuthorized.HandleFunc("", handler.updateIncident).Methods(http.MethodPatch)
	incidentRouterAuthorized.HandleFunc("/end", handler.endIncident).Methods(http.MethodPut)
	incidentRouterAuthorized.HandleFunc("/restart", handler.restartIncident).Methods(http.MethodPut)
	incidentRouterAuthorized.HandleFunc("/commander", handler.changeCommander).Methods(http.MethodPost)

	channelRouter := incidentsRouter.PathPrefix("/channel").Subrouter()
	channelRouter.HandleFunc("/{channel_id:[A-Za-z0-9]+}", handler.getIncidentByChannel).Methods(http.MethodGet)

	checklistsRouter := incidentRouterAuthorized.PathPrefix("/checklists").Subrouter()

	checklistRouter := checklistsRouter.PathPrefix("/{checklist:[0-9]+}").Subrouter()
	checklistRouter.HandleFunc("/add", handler.addChecklistItem).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/reorder", handler.reorderChecklist).Methods(http.MethodPut)

	checklistItem := checklistRouter.PathPrefix("/item/{item:[0-9]+}").Subrouter()
	checklistItem.HandleFunc("", handler.itemDelete).Methods(http.MethodDelete)
	checklistItem.HandleFunc("", handler.itemRename).Methods(http.MethodPut)
	checklistItem.HandleFunc("/state", handler.itemSetState).Methods(http.MethodPut)
	checklistItem.HandleFunc("/assignee", handler.itemSetAssignee).Methods(http.MethodPut)

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

func (h *IncidentHandler) createIncidentFromPost(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var payloadIncident incident.Incident
	if err := json.NewDecoder(r.Body).Decode(&payloadIncident); err != nil {
		HandleError(w, errors.Wrapf(err, "unable to decode incident"))
		return
	}

	newIncident, err := h.createIncident(payloadIncident, userID)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "unable to create incident"))
		return
	}

	ReturnJSON(w, &newIncident)
}

func (h *IncidentHandler) updateIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	oldIncident, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	var updates incident.UpdateOptions
	if err = json.NewDecoder(r.Body).Decode(&updates); err != nil {
		HandleError(w, errors.Wrapf(err, "unable to decode payload"))
		return
	}

	updatedIncident := oldIncident

	if updates.ActiveStage != nil {
		updatedIncident, err = h.incidentService.ChangeActiveStage(oldIncident.ID, userID, *updates.ActiveStage)
		if err != nil {
			HandleError(w, errors.Wrap(err, "unable to change active stage"))
			return
		}
	}

	jsonBytes, err := json.Marshal(updatedIncident)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
}

// createIncidentFromDialog handles the interactive dialog submission when a user presses confirm on
// the create incident dialog.
func (h *IncidentHandler) createIncidentFromDialog(w http.ResponseWriter, r *http.Request) {
	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		HandleError(w, errors.New("failed to decode SubmitDialogRequest"))
		return
	}

	var state incident.DialogState
	err := json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "failed to unmarshal dialog state"))
		return
	}

	name := request.Submission[incident.DialogFieldNameKey].(string)
	playbookID := request.Submission[incident.DialogFieldPlaybookIDKey].(string)

	payloadIncident := incident.Incident{
		Header: incident.Header{
			CommanderUserID: request.UserId,
			TeamID:          request.TeamId,
			Name:            name,
		},
		PostID:   state.PostID,
		Playbook: &playbook.Playbook{ID: playbookID},
	}

	newIncident, err := h.createIncident(payloadIncident, request.UserId)
	if err != nil {
		var msg string

		if errors.Is(err, incident.ErrChannelDisplayNameInvalid) {
			msg = "The channel name is invalid or too long. Please use a valid name with fewer than 64 characters."
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

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) createIncident(newIncident incident.Incident, userID string) (*incident.Incident, error) {
	if newIncident.ID != "" {
		return nil, errors.New("incident already has an id")
	}

	if newIncident.PrimaryChannelID != "" {
		return nil, errors.New("incident channel already has an id")
	}

	if newIncident.CreatedAt != 0 {
		return nil, errors.New("incident channel already has created at date")
	}

	if newIncident.EndedAt != 0 {
		return nil, errors.New("incident channel already has ended at date")
	}

	if newIncident.TeamID == "" {
		return nil, errors.New("missing team id of incident")
	}

	if newIncident.CommanderUserID == "" {
		return nil, errors.New("missing commander user id of incident")
	}

	// Commander should have permission to the team
	if err := permissions.ViewTeam(newIncident.CommanderUserID, newIncident.TeamID, h.pluginAPI); err != nil {
		return nil, errors.New("commander user does not have permissions for the team")
	}

	public := true
	if newIncident.Playbook != nil && newIncident.Playbook.ID != "" {
		pb, err := h.playbookService.Get(newIncident.Playbook.ID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook")
		}

		newIncident.Playbook = &pb
		public = newIncident.Playbook.CreatePublicIncident
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

	return h.incidentService.CreateIncident(&newIncident, public)
}

// getIncidents handles the GET /incidents endpoint.
func (h *IncidentHandler) getIncidents(w http.ResponseWriter, r *http.Request) {
	filterOptions, err := parseIncidentsFilterOption(r.URL)
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	filterOptions.HasPermissionsTo = func(channelID string) bool {
		err2 := permissions.ViewIncidentFromChannelID(userID, channelID, h.pluginAPI, h.incidentService)
		return err2 == nil
	}

	results, err := h.incidentService.GetIncidents(*filterOptions)
	if err != nil {
		HandleError(w, err)
		return
	}

	// To return an empty array as opposed to null
	if results.Items == nil {
		results.Items = []incident.Incident{}
	}

	jsonBytes, err := json.Marshal(listIncidentResult{
		listResult: listResult{
			TotalCount: results.TotalCount,
			PageCount:  results.PageCount,
			HasMore:    results.HasMore,
		},
		Items: results.Items,
	})
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
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

	jsonBytes, err := json.Marshal(incidentToGet)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
}

// getIncidentWithDetails handles the /incidents/{id}/details endpoint.
func (h *IncidentHandler) getIncidentWithDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := permissions.ViewIncident(userID, incidentID, h.pluginAPI, h.incidentService); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized",
			errors.Errorf("userid: %s does not have permissions to view the incident details", userID))
		return
	}

	incidentToGet, err := h.incidentService.GetIncidentWithDetails(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(incidentToGet)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
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

	jsonBytes, err := json.Marshal(incidentToGet)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
}

// endIncident handles the /incidents/{id}/end api endpoint.
func (h *IncidentHandler) endIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	err := h.incidentService.EndIncident(vars["id"], userID)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "OK"}`))
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
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

// endIncidentFromDialog handles the interactive dialog submission when a user confirms they
// want to end an incident.
func (h *IncidentHandler) endIncidentFromDialog(w http.ResponseWriter, r *http.Request) {
	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		HandleError(w, errors.New("failed to decode SubmitDialogRequest"))
		return
	}

	err := h.incidentService.EndIncident(request.State, request.UserId)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "failed to end incident"))
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

// getCommanders handles the /incidents/commanders api endpoint.
func (h *IncidentHandler) getCommanders(w http.ResponseWriter, r *http.Request) {
	teamID := r.URL.Query().Get("team_id")
	if teamID == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter: team_id", errors.New("team_id required"))
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if err := permissions.ViewTeam(userID, teamID, h.pluginAPI); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s",
			userID,
			teamID,
		))
		return
	}

	options := incident.HeaderFilterOptions{
		TeamID: teamID,
		HasPermissionsTo: func(channelID string) bool {
			err := permissions.ViewIncidentFromChannelID(userID, channelID, h.pluginAPI, h.incidentService)
			return err == nil
		},
	}
	commanders, err := h.incidentService.GetCommanders(options)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "failed to get commanders"))
		return
	}

	jsonBytes, err := json.Marshal(commanders)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
}

func (h *IncidentHandler) getChannels(w http.ResponseWriter, r *http.Request) {
	teamID := r.URL.Query().Get("team_id")
	if teamID == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter: team_id", errors.New("team_id required"))
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if err := permissions.ViewTeam(userID, teamID, h.pluginAPI); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s",
			userID,
			teamID,
		))
		return
	}

	options := incident.HeaderFilterOptions{
		TeamID: teamID,
		Status: incident.Ongoing,
		HasPermissionsTo: func(channelID string) bool {
			err := permissions.ViewIncidentFromChannelID(userID, channelID, h.pluginAPI, h.incidentService)
			return err == nil
		},
	}
	incidents, err := h.incidentService.GetIncidents(options)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "failed to get commanders"))
		return
	}

	channelIds := make([]string, 0, len(incidents.Items))
	for _, incident := range incidents.Items {
		channelIds = append(channelIds, incident.PrimaryChannelID)
	}

	jsonBytes, err := json.Marshal(channelIds)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
}

// changeCommander handles the /incidents/{id}/change-commander api endpoint.
func (h *IncidentHandler) changeCommander(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		CommanderID string `json:"commander_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleError(w, errors.Wrapf(err, "could not decode request body"))
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
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

// getChecklistAutocomplete handles the GET /incidents/checklists-autocomplete api endpoint
func (h *IncidentHandler) getChecklistAutocomplete(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	incidentID, err := h.incidentService.GetIncidentIDForChannel(query.Get("channel_id"))
	if err != nil {
		HandleError(w, err)
		return
	}

	data, err := h.incidentService.GetChecklistAutocomplete(incidentID)
	if err != nil {
		HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
}

func (h *IncidentHandler) itemSetState(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse checklist"))
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse item"))
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		NewState string `json:"new_state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleError(w, errors.Wrap(err, "failed to unmarshal"))
		return
	}

	if !playbook.IsValidChecklistItemState(params.NewState) {
		HandleError(w, errors.New("bad parameter new state"))
		return
	}

	if err := h.incidentService.ModifyCheckedState(id, userID, params.NewState, checklistNum, itemNum); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

func (h *IncidentHandler) itemSetAssignee(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse checklist"))
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse item"))
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		AssigneeID string `json:"assignee_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleError(w, errors.Wrap(err, "failed to unmarshal"))
		return
	}

	if err := h.incidentService.SetAssignee(id, userID, params.AssigneeID, checklistNum, itemNum); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

func (h *IncidentHandler) addChecklistItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse checklist"))
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var checklistItem playbook.ChecklistItem
	if err := json.NewDecoder(r.Body).Decode(&checklistItem); err != nil {
		HandleError(w, errors.Wrap(err, "failed to decode ChecklistItem"))
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

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

func (h *IncidentHandler) itemDelete(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse checklist"))
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse item"))
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.incidentService.RemoveChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

func (h *IncidentHandler) itemRename(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse checklist"))
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse item"))
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Title   string `json:"title"`
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleError(w, errors.Wrap(err, "failed to unmarshal edit params state"))
		return
	}

	if err := h.incidentService.RenameChecklistItem(id, userID, checklistNum, itemNum, params.Title, params.Command); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

func (h *IncidentHandler) reorderChecklist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse checklist"))
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var modificationParams struct {
		ItemNum     int `json:"item_num"`
		NewLocation int `json:"new_location"`
	}
	if err := json.NewDecoder(r.Body).Decode(&modificationParams); err != nil {
		HandleError(w, errors.Wrap(err, "failed to unmarshal edit params"))
		return
	}

	if err := h.incidentService.MoveChecklistItem(id, userID, checklistNum, modificationParams.ItemNum, modificationParams.NewLocation); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

func (h *IncidentHandler) postIncidentCreatedMessage(incdnt *incident.Incident, channelID string) error {
	channel, err := h.pluginAPI.Channel.Get(incdnt.PrimaryChannelID)
	if err != nil {
		return err
	}

	msg := fmt.Sprintf("Incident %s started in ~%s", incdnt.Name, channel.Name)
	h.poster.Ephemeral(incdnt.CommanderUserID, channelID, "%s", msg)

	return nil
}

func parseIncidentsFilterOption(u *url.URL) (*incident.HeaderFilterOptions, error) {
	// NOTE: we are failing early instead of turning bad parameters into the default
	teamID := u.Query().Get("team_id")
	if teamID != "" && !model.IsValidId(teamID) {
		return nil, errors.New("bad parameter 'team_id': must be 26 characters or blank")
	}

	param := u.Query().Get("page")
	if param == "" {
		param = "0"
	}
	page, err := strconv.Atoi(param)
	if err != nil {
		return nil, errors.Wrapf(err, "bad parameter 'page'")
	}

	param = u.Query().Get("per_page")
	if param == "" {
		param = "0"
	}
	perPage, err := strconv.Atoi(param)
	if err != nil {
		return nil, errors.Wrapf(err, "bad parameter 'per_page'")
	}

	param = u.Query().Get("sort")
	var sort incident.SortField
	switch param {
	case "id":
		sort = incident.ID
	case "name":
		sort = incident.Name
	case "commander_user_id":
		sort = incident.CommanderUserID
	case "team_id":
		sort = incident.TeamID
	case "created_at", "": // default
		sort = incident.CreatedAt
	case "ended_at":
		sort = incident.EndedAt
	case "status":
		sort = incident.ByStatus
	default:
		return nil, errors.New("bad parameter 'sort'")
	}

	param = u.Query().Get("order")
	var order incident.SortDirection
	switch param {
	case "asc":
		order = incident.Asc
	case "desc", "":
		order = incident.Desc
	default:
		return nil, errors.Wrapf(err, "bad parameter 'order_by'")
	}

	param = u.Query().Get("status")
	status := incident.All
	if param == "active" {
		status = incident.Ongoing
	} else if param == "ended" {
		status = incident.Ended
	}

	commanderID := u.Query().Get("commander_user_id")
	searchTerm := u.Query().Get("search_term")

	return &incident.HeaderFilterOptions{
		TeamID:      teamID,
		Page:        page,
		PerPage:     perPage,
		Sort:        sort,
		Order:       order,
		Status:      status,
		CommanderID: commanderID,
		SearchTerm:  searchTerm,
	}, nil
}
