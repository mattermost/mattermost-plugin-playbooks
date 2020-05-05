package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/permissions"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
)

// IncidentHandler is the API handler.
type IncidentHandler struct {
	incidentService incident.Service
	playbookService playbook.Service
	pluginAPI       *pluginapi.Client
	poster          bot.Poster
}

// NewIncidentHandler Creates a new Plugin API handler.
func NewIncidentHandler(router *mux.Router, incidentService incident.Service, playbookService playbook.Service, api *pluginapi.Client, poster bot.Poster) *IncidentHandler {
	handler := &IncidentHandler{
		incidentService: incidentService,
		playbookService: playbookService,
		pluginAPI:       api,
		poster:          poster,
	}

	incidentsRouter := router.PathPrefix("/incidents").Subrouter()
	incidentsRouter.HandleFunc("", handler.createIncident).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("", handler.getIncidents).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/create-dialog", handler.createIncidentFromDialog).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("/end-dialog", handler.endIncidentFromDialog).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("/commanders", handler.getCommanders).Methods(http.MethodGet)

	incidentRouter := incidentsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	incidentRouter.HandleFunc("", handler.getIncident).Methods(http.MethodGet)

	incidentRouterAuthorized := incidentRouter.PathPrefix("").Subrouter()
	incidentRouterAuthorized.Use(handler.permissionsToIncidentChannelRequired)
	incidentRouterAuthorized.HandleFunc("/end", handler.endIncident).Methods(http.MethodPut)
	incidentRouterAuthorized.HandleFunc("/commander", handler.changeCommander).Methods(http.MethodPost)

	checklistsRouter := incidentRouter.PathPrefix("/checklists").Subrouter()

	checklistRouter := checklistsRouter.PathPrefix("/{checklist:[0-9]+}").Subrouter()
	checklistRouter.HandleFunc("/add", handler.addChecklistItem).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/reorder", handler.reorderChecklist).Methods(http.MethodPut)

	checklistItem := checklistRouter.PathPrefix("/item/{item:[0-9]+}").Subrouter()
	checklistItem.HandleFunc("", handler.itemDelete).Methods(http.MethodDelete)
	checklistItem.HandleFunc("", handler.itemRename).Methods(http.MethodPut)
	checklistItem.HandleFunc("/check", handler.check).Methods(http.MethodPut)
	checklistItem.HandleFunc("/uncheck", handler.uncheck).Methods(http.MethodPut)

	return handler
}

// permissionsToIncidentChannelRequired checks that the requester is admin or has read access
// to the primary incident channel.
func (h *IncidentHandler) permissionsToIncidentChannelRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		if err := permissions.CheckHasPermissionsToIncidentChannel(userID, vars["id"], h.pluginAPI, h.incidentService); err != nil {
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

func (h *IncidentHandler) createIncident(w http.ResponseWriter, r *http.Request) {
	_, err := h.incidentService.CreateIncident(nil)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
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
		HandleError(w, fmt.Errorf("failed to unmarshal dialog state: %w", err))
		return
	}

	name := request.Submission[incident.DialogFieldNameKey].(string)

	var playbookTemplate *playbook.Playbook
	if playbookID, hasPlaybookID := request.Submission[incident.DialogFieldPlaybookIDKey].(string); hasPlaybookID {
		if playbookID != "" && playbookID != "-1" {
			var pb playbook.Playbook
			pb, err = h.playbookService.Get(playbookID)
			if err != nil {
				HandleError(w, fmt.Errorf("failed to get playbook: %w", err))
				return
			}
			playbookTemplate = &pb
		}
	}

	newIncident, err := h.incidentService.CreateIncident(&incident.Incident{
		Header: incident.Header{
			CommanderUserID: request.UserId,
			TeamID:          request.TeamId,
			Name:            name,
		},
		PostID:   state.PostID,
		Playbook: playbookTemplate,
	})

	if err != nil {
		var msg string

		if errors.Is(err, incident.ErrChannelDisplayNameLong) {
			msg = "The channel name is too long. Please use a name with fewer than 64 characters."
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

	h.poster.PublishWebsocketEventToUser(incident.IncidentCreatedWSEvent, map[string]interface{}{"client_id": state.ClientID, "incident": newIncident}, request.UserId)

	if err := h.postIncidentCreatedMessage(newIncident, request.ChannelId); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) getIncidents(w http.ResponseWriter, r *http.Request) {
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

	filterOptions, err := parseIncidentsFilterOption(r.URL, teamID)
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	incidents, err := h.incidentService.GetIncidents(*filterOptions)
	if err != nil {
		HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(incidents)
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

	// User must have permission to the team that this incident belongs to. They do not have to have
	// permissions to the incident channel.
	if err := permissions.CheckHasPermissionsToIncidentTeam(userID, incidentID, h.pluginAPI, h.incidentService); err != nil {
		if errors.Is(err, permissions.ErrNoPermissions) {
			HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err)
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
		HandleError(w, fmt.Errorf("failed to end incident: %w", err))
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

	// Check permissions (if is an admin, they will have permissions to view all teams)
	userID := r.Header.Get("Mattermost-User-ID")
	if !h.pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PERMISSION_VIEW_TEAM) {
		HandleErrorWithCode(w, http.StatusForbidden, "permissions error", fmt.Errorf("userID %s does not have view permission for teamID %s", userID, teamID))
		return
	}

	active, _ := strconv.ParseBool(r.URL.Query().Get("active"))

	commanders, err := h.incidentService.GetCommandersForTeam(teamID, active)
	if err != nil {
		HandleError(w, fmt.Errorf("failed to get commanders: %w", err))
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

// changeCommander handles the /incidents/{id}/change-commander api endpoint.
func (h *IncidentHandler) changeCommander(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		CommanderID string `json:"commander_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleError(w, fmt.Errorf("could not decode request body: %w", err))
		return
	}

	// Check if the target user (params.CommanderID) has permissions
	if err := permissions.CheckHasPermissionsToIncidentChannel(params.CommanderID, vars["id"], h.pluginAPI, h.incidentService); err != nil {
		if errors.Is(err, permissions.ErrNoPermissions) {
			HandleErrorWithCode(w, http.StatusForbidden, "Not authorized",
				fmt.Errorf("userid: %s does not have permissions to incident channel; cannot be made commander", params.CommanderID))
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

func (h *IncidentHandler) checkuncheck(w http.ResponseWriter, r *http.Request, check bool) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleError(w, err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleError(w, err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.incidentService.ModifyCheckedState(id, userID, check, checklistNum, itemNum); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

func (h *IncidentHandler) check(w http.ResponseWriter, r *http.Request) {
	h.checkuncheck(w, r, true)
}

func (h *IncidentHandler) uncheck(w http.ResponseWriter, r *http.Request) {
	h.checkuncheck(w, r, false)
}

func (h *IncidentHandler) addChecklistItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		HandleError(w, err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var checklistItem playbook.ChecklistItem
	if err := json.NewDecoder(r.Body).Decode(&checklistItem); err != nil {
		HandleError(w, err)
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
		HandleError(w, err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleError(w, err)
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
		HandleError(w, err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		HandleError(w, err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		HandleError(w, fmt.Errorf("failed to unmarshal edit params state: %w", err))
		return
	}

	if err := h.incidentService.RenameChecklistItem(id, userID, checklistNum, itemNum, params.Title); err != nil {
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
		HandleError(w, err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var modificationParams struct {
		ItemNum     int `json:"item_num"`
		NewLocation int `json:"new_location"`
	}
	if err := json.NewDecoder(r.Body).Decode(&modificationParams); err != nil {
		HandleError(w, err)
		return
	}

	if err := h.incidentService.MoveChecklistItem(id, userID, checklistNum, modificationParams.ItemNum, modificationParams.NewLocation); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "OK"}`))
}

func (h *IncidentHandler) postIncidentCreatedMessage(incident *incident.Incident, channelID string) error {
	channel, err := h.pluginAPI.Channel.Get(incident.ChannelIDs[0])
	if err != nil {
		return err
	}

	msg := fmt.Sprintf("Incident %s started in ~%s", incident.Name, channel.Name)
	h.poster.Ephemeral(incident.CommanderUserID, channelID, "%s", msg)

	return nil
}

func parseIncidentsFilterOption(u *url.URL, teamID string) (*incident.HeaderFilterOptions, error) {
	// NOTE: we are failing early instead of turning bad parameters into the default
	param := u.Query().Get("page")
	if param == "" {
		param = "0"
	}
	page, err := strconv.Atoi(param)
	if err != nil {
		return nil, fmt.Errorf("bad parameter 'page': %w", err)
	}

	param = u.Query().Get("per_page")
	if param == "" {
		param = "0"
	}
	perPage, err := strconv.Atoi(param)
	if err != nil {
		return nil, fmt.Errorf("bad parameter 'per_page': %w", err)
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
	default:
		return nil, errors.New("bad parameter 'sort'")
	}

	param = u.Query().Get("order")
	var order incident.SortDirection
	if param == "asc" {
		order = incident.Asc
	} else if param == "desc" || param == "" {
		order = incident.Desc
	} else {
		return nil, fmt.Errorf("bad parameter 'order_by': %w", err)
	}

	active, _ := strconv.ParseBool(u.Query().Get("active"))
	commanderID := u.Query().Get("commander_user_id")

	return &incident.HeaderFilterOptions{
		TeamID:      teamID,
		Page:        page,
		PerPage:     perPage,
		Sort:        sort,
		Order:       order,
		Active:      active,
		CommanderID: commanderID,
	}, nil
}
