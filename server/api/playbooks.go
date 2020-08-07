package api

import (
	"encoding/json"
	"math"
	"net/http"
	"net/url"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type listPlaybookResult struct {
	listResult
	Items []playbook.Playbook `json:"items"`
}

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

	if !h.pluginAPI.User.HasPermissionToTeam(userID, pbook.TeamID, model.PERMISSION_VIEW_TEAM) {
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
	opts, page, perPage, err := parseGetPlaybooksOptions(r.URL)
	if err != nil {
		HandleError(w, errors.Wrap(err, "failed to parse playbook options"))
		return
	}

	if teamID == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "Provide a team ID", nil)
		return
	}

	if !h.pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PERMISSION_VIEW_TEAM) {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to get playbooks on teamID %s",
			userID,
			teamID,
		))
		return
	}

	playbooks, err := h.playbookService.GetPlaybooksForTeam(teamID, opts)
	if err != nil {
		HandleError(w, err)
		return
	}

	allowedPlaybooks := []playbook.Playbook{}
	for _, pb := range playbooks {
		if h.hasPermissionsToPlaybook(pb, userID) {
			allowedPlaybooks = append(allowedPlaybooks, pb)
		}
	}
	totalCount := len(allowedPlaybooks)
	// Note: ignoring overflow for now
	pageCount := int(math.Ceil((float64(totalCount) / float64(perPage))))
	hasMore := page != pageCount-1
	if totalCount == 0 || page >= pageCount {
		hasMore = false
	}

	jsonBytes, err := json.Marshal(listPlaybookResult{
		listResult: listResult{
			TotalCount: totalCount,
			PageCount:  pageCount,
			HasMore:    hasMore,
		},
		Items: pagePlaybooks(allowedPlaybooks, page, perPage),
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

func (h *PlaybookHandler) hasPermissionsToPlaybook(thePlaybook playbook.Playbook, userID string) bool {
	if !h.pluginAPI.User.HasPermissionToTeam(userID, thePlaybook.TeamID, model.PERMISSION_VIEW_TEAM) {
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

func parseGetPlaybooksOptions(u *url.URL) (opts playbook.Options, page, perPage int, err error) {
	params := u.Query()

	sortField := playbook.SortField(params.Get("sort"))
	if sortField == "" {
		sortField = playbook.Title
	}

	sortDirection := playbook.SortDirection(params.Get("direction"))
	if sortDirection == "" {
		sortDirection = playbook.Asc
	}

	param := params.Get("page")
	if param == "" {
		param = "0"
	}
	page, err = strconv.Atoi(param)
	if err != nil {
		return playbook.Options{}, 0, 0, errors.Wrapf(err, "bad parameter 'page'")
	}
	if page < 0 {
		return playbook.Options{}, 0, 0, errors.Errorf("bad parameter 'page'")
	}

	param = params.Get("per_page")
	if param == "" || param == "0" {
		param = "1000"
	}
	perPage, err = strconv.Atoi(param)
	if err != nil {
		return playbook.Options{}, 0, 0, errors.Wrapf(err, "bad parameter 'per_page'")
	}
	if perPage < 0 {
		return playbook.Options{}, 0, 0, errors.Errorf("bad parameter 'per_page'")
	}

	return playbook.Options{
		Sort:      sortField,
		Direction: sortDirection,
	}, page, perPage, nil
}

func pagePlaybooks(playbooks []playbook.Playbook, page, perPage int) []playbook.Playbook {
	// Note: ignoring overflow for now
	start := min(page*perPage, len(playbooks))
	end := min(start+perPage, len(playbooks))
	return playbooks[start:end]
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
