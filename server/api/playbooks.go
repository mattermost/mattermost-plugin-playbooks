package api

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/permissions"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// PlaybookHandler is the API handler.
type PlaybookHandler struct {
	playbookService playbook.Service
	pluginAPI       *pluginapi.Client
	log             bot.Logger
}

// NewPlaybookHandler returns a new playbook api handler
func NewPlaybookHandler(router *mux.Router, playbookService playbook.Service, api *pluginapi.Client, log bot.Logger) *PlaybookHandler {
	handler := &PlaybookHandler{
		playbookService: playbookService,
		pluginAPI:       api,
		log:             log,
	}

	playbooksRouter := router.PathPrefix("/playbooks").Subrouter()
	playbooksRouter.HandleFunc("", handler.createPlaybook).Methods(http.MethodPost)
	playbooksRouter.HandleFunc("", handler.getPlaybooks).Methods(http.MethodGet)

	playbookRouter := playbooksRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	playbookRouter.HandleFunc("", handler.getPlaybook).Methods(http.MethodGet)
	playbookRouter.HandleFunc("", handler.updatePlaybook).Methods(http.MethodPut)
	playbookRouter.HandleFunc("", handler.deletePlaybook).Methods(http.MethodDelete)

	return handler
}

func (h *PlaybookHandler) createPlaybook(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var pbook playbook.Playbook
	if err := json.NewDecoder(r.Body).Decode(&pbook); err != nil {
		HandleError(w, errors.Wrapf(err, "unable to decode playbook"))
		return
	}

	if pbook.ID != "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "Playbook given already has ID", nil)
		return
	}

	if err := permissions.ViewTeam(userID, pbook.TeamID, h.pluginAPI); err != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to create playbook on teamID %s",
			userID,
			pbook.TeamID,
		))
		return
	}

	id, err := h.playbookService.Create(pbook)
	if err != nil {
		HandleError(w, err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: id,
	}
	ReturnJSON(w, &result)
}

func (h *PlaybookHandler) getPlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	pbook, err := h.playbookService.Get(vars["id"])
	if err != nil {
		HandleError(w, err)
		return
	}

	if !h.hasPermissionsToPlaybook(pbook, userID) {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to get playbook on teamID %s",
			userID,
			pbook.TeamID,
		))
		return
	}

	ReturnJSON(w, &pbook)
}

func (h *PlaybookHandler) updatePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	var pbook playbook.Playbook
	if err := json.NewDecoder(r.Body).Decode(&pbook); err != nil {
		HandleError(w, errors.Wrap(err, "unable to decode playbook"))
		return
	}

	// Force parsed playbook id to be URL parameter id
	pbook.ID = vars["id"]

	oldPlaybook, err := h.playbookService.Get(vars["id"])
	if err != nil {
		HandleError(w, err)
		return
	}

	if !h.hasPermissionsToPlaybook(oldPlaybook, userID) {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to update playbook on teamID %s",
			userID,
			oldPlaybook.TeamID,
		))
		return
	}

	err = h.playbookService.Update(pbook)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err = w.Write([]byte(`{"status": "OK"}`)); err != nil {
		HandleError(w, err)
	}
}

func (h *PlaybookHandler) deletePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	playbookToDelete, err := h.playbookService.Get(vars["id"])
	if err != nil {
		HandleError(w, err)
		return
	}

	if !h.hasPermissionsToPlaybook(playbookToDelete, userID) {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to delete playbook on teamID %s",
			userID,
			playbookToDelete.TeamID,
		))
		return
	}

	err = h.playbookService.Delete(playbookToDelete)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err = w.Write([]byte(`{"status": "OK"}`)); err != nil {
		HandleError(w, err)
	}
}

func (h *PlaybookHandler) getPlaybooks(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	teamID := params.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")
	opts, err := parseGetPlaybooksOptions(r.URL)
	if err != nil {
		HandleError(w, err)
		return
	}

	opts.HasPermissionsTo = h.hasPermissionsToPlaybook

	if teamID == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "Provide a team ID", nil)
		return
	}

	if err2 := permissions.ViewTeam(userID, teamID, h.pluginAPI); err2 != nil {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to get playbooks on teamID %s",
			userID,
			teamID,
		))
		return
	}

	playbookResults, err := h.playbookService.GetPlaybooksForTeam(userID, teamID, opts)
	if err != nil {
		HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(playbookResults)
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

func (h *PlaybookHandler) hasPermissionsToPlaybook(thePlaybook playbook.Playbook, userID string) bool {
	if err := permissions.ViewTeam(userID, thePlaybook.TeamID, h.pluginAPI); err != nil {
		return false
	}

	for _, memberID := range thePlaybook.MemberIDs {
		if memberID == userID {
			return true
		}
	}

	// Fallback to admin role that have access to all playbooks.
	return h.pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM)
}

func parseGetPlaybooksOptions(u *url.URL) (playbook.Options, error) {
	params := u.Query()

	var sortField playbook.SortField
	param := strings.ToLower(params.Get("sort"))
	switch param {
	case "title", "":
		sortField = playbook.SortByTitle
	case "stages":
		sortField = playbook.SortByStages
	case "steps":
		sortField = playbook.SortBySteps
	default:
		return playbook.Options{}, errors.Errorf("bad parameter 'sort' (%s): it should be empty or one of 'title', 'stages' or 'steps'", param)
	}

	var sortDirection playbook.SortDirection
	param = strings.ToLower(params.Get("direction"))
	switch param {
	case "asc", "":
		sortDirection = playbook.OrderAsc
	case "desc":
		sortDirection = playbook.OrderDesc
	default:
		return playbook.Options{}, errors.Errorf("bad parameter 'direction' (%s): it should be empty or one of 'asc' or 'desc'", param)
	}

	pageParam := params.Get("page")
	if pageParam == "" {
		pageParam = "0"
	}
	page, err := strconv.Atoi(pageParam)
	if err != nil {
		return playbook.Options{}, errors.Wrapf(err, "bad parameter 'page': it should be a number")
	}
	if page < 0 {
		return playbook.Options{}, errors.Errorf("bad parameter 'page': it should be a positive number")
	}

	perPageParam := params.Get("per_page")
	if perPageParam == "" || perPageParam == "0" {
		perPageParam = "1000"
	}
	perPage, err := strconv.Atoi(perPageParam)
	if err != nil {
		return playbook.Options{}, errors.Wrapf(err, "bad parameter 'per_page': it should be a number")
	}
	if perPage < 0 {
		return playbook.Options{}, errors.Errorf("bad parameter 'per_page': it should be a positive number")
	}

	return playbook.Options{
		Sort:      sortField,
		Direction: sortDirection,
		Page:      page,
		PerPage:   perPage,
	}, nil
}
