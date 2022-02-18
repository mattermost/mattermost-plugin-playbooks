package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// PlaybookHandler is the API handler.
type PlaybookHandler struct {
	*ErrorHandler
	playbookService app.PlaybookService
	pluginAPI       *pluginapi.Client
	log             bot.Logger
	config          config.Service
	permissions     *app.PermissionsService
}

const SettingsKey = "global_settings"
const maxPlaybooksToAutocomplete = 15

// NewPlaybookHandler returns a new playbook api handler
func NewPlaybookHandler(router *mux.Router, playbookService app.PlaybookService, api *pluginapi.Client, log bot.Logger, configService config.Service, permissions *app.PermissionsService) *PlaybookHandler {
	handler := &PlaybookHandler{
		ErrorHandler:    &ErrorHandler{log: log},
		playbookService: playbookService,
		pluginAPI:       api,
		log:             log,
		config:          configService,
		permissions:     permissions,
	}

	playbooksRouter := router.PathPrefix("/playbooks").Subrouter()

	playbooksRouter.HandleFunc("", handler.createPlaybook).Methods(http.MethodPost)

	playbooksRouter.HandleFunc("", handler.getPlaybooks).Methods(http.MethodGet)
	playbooksRouter.HandleFunc("/autocomplete", handler.getPlaybooksAutoComplete).Methods(http.MethodGet)
	playbooksRouter.HandleFunc("/import", handler.importPlaybook).Methods(http.MethodPost)

	playbookRouter := playbooksRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	playbookRouter.HandleFunc("", handler.getPlaybook).Methods(http.MethodGet)
	playbookRouter.HandleFunc("", handler.updatePlaybook).Methods(http.MethodPut)
	playbookRouter.HandleFunc("", handler.archivePlaybook).Methods(http.MethodDelete)
	playbookRouter.HandleFunc("/restore", handler.restorePlaybook).Methods(http.MethodPut)
	playbookRouter.HandleFunc("/export", handler.exportPlaybook).Methods(http.MethodGet)
	playbookRouter.HandleFunc("/duplicate", handler.duplicatePlaybook).Methods(http.MethodPost)

	autoFollowsRouter := playbookRouter.PathPrefix("/autofollows").Subrouter()
	autoFollowRouter := autoFollowsRouter.PathPrefix("/{userID:[A-Za-z0-9]+}").Subrouter()
	autoFollowRouter.HandleFunc("", handler.autoFollow).Methods(http.MethodPut)
	autoFollowRouter.HandleFunc("", handler.autoUnfollow).Methods(http.MethodDelete)
	autoFollowRouter.HandleFunc("", handler.isAutoFollowing).Methods(http.MethodGet)

	return handler
}

func (h *PlaybookHandler) validPlaybookCreation(w http.ResponseWriter, playbook *app.Playbook) bool {
	if playbook.WebhookOnCreationEnabled {
		if len(playbook.WebhookOnCreationURLs) > 64 {
			msg := "too many registered creation webhook urls, limit to less than 64"
			h.HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
			return false
		}

		for _, webhook := range playbook.WebhookOnCreationURLs {
			url, err := url.ParseRequestURI(webhook)
			if err != nil {
				h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid creation webhook URL", err)
				return false
			}

			if url.Scheme != "http" && url.Scheme != "https" {
				msg := fmt.Sprintf("protocol in creation webhook URL is %s; only HTTP and HTTPS are accepted", url.Scheme)
				h.HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
				return false
			}
		}
	}

	if playbook.WebhookOnStatusUpdateEnabled {
		if len(playbook.WebhookOnStatusUpdateURLs) > 64 {
			msg := "too many registered update webhook urls, limit to less than 64"
			h.HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
			return false
		}

		for _, webhook := range playbook.WebhookOnStatusUpdateURLs {
			url, err := url.ParseRequestURI(webhook)
			if err != nil {
				h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid update webhook URL", err)
				return false
			}

			if url.Scheme != "http" && url.Scheme != "https" {
				msg := fmt.Sprintf("protocol in update webhook URL is %s; only HTTP and HTTPS are accepted", url.Scheme)
				h.HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
				return false
			}
		}
	}

	if playbook.CategorizeChannelEnabled {
		if err := h.validateCategoryName(playbook.CategoryName); err != nil {
			h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid category name", err)
			return false
		}
	}

	if len(playbook.SignalAnyKeywords) != 0 {
		playbook.SignalAnyKeywords = removeDuplicates(playbook.SignalAnyKeywords)
	}

	if playbook.BroadcastEnabled {
		for _, channelID := range playbook.BroadcastChannelIDs {
			channel, err := h.pluginAPI.Channel.Get(channelID)
			if err != nil {
				h.HandleErrorWithCode(w, http.StatusBadRequest, "broadcasting to invalid channel ID", err)
				return false
			}
			// check if channel is archived
			if channel.DeleteAt != 0 {
				h.HandleErrorWithCode(w, http.StatusBadRequest, "broadcasting to archived channel", err)
				return false
			}
		}
	}

	return true
}

func (h *PlaybookHandler) createPlaybook(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	var playbook app.Playbook
	if err := json.NewDecoder(r.Body).Decode(&playbook); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode playbook", err)
		return
	}

	if playbook.ID != "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Playbook given already has ID", nil)
		return
	}

	if playbook.ReminderTimerDefaultSeconds <= 0 {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "playbook ReminderTimerDefaultSeconds must be > 0", nil)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.PlaybookCreate(userID, playbook)) {
		return
	}

	// If not specified make the creator the sole admin
	if len(playbook.Members) == 0 {
		playbook.Members = []app.PlaybookMember{
			{
				UserID: userID,
				Roles:  []string{app.PlaybookRoleMember, app.PlaybookRoleAdmin},
			},
		}
	}

	if !h.validPlaybookCreation(w, &playbook) {
		return
	}

	if err := h.validateMetrics(playbook); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid metrics configs", err)
		return
	}

	id, err := h.playbookService.Create(playbook, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: id,
	}
	w.Header().Add("Location", makeAPIURL(h.pluginAPI, "playbooks/%s", id))

	ReturnJSON(w, &result, http.StatusCreated)
}

func (h *PlaybookHandler) getPlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, h.permissions.PlaybookView(userID, playbookID)) {
		return
	}

	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, &playbook, http.StatusOK)
}

func (h *PlaybookHandler) updatePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	var playbook app.Playbook
	if err := json.NewDecoder(r.Body).Decode(&playbook); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode playbook", err)
		return
	}

	// Force parsed playbook id to be URL parameter id
	playbook.ID = vars["id"]
	oldPlaybook, err := h.playbookService.Get(playbook.ID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err := h.validateMetrics(playbook); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid metrics configs", err)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.PlaybookModifyWithFixes(userID, &playbook, oldPlaybook)) {
		return
	}

	if oldPlaybook.DeleteAt != 0 {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Playbook cannot be modified", fmt.Errorf("playbook with id '%s' cannot be modified because it is archived", playbook.ID))
		return
	}

	if playbook.WebhookOnCreationEnabled {
		for _, webhook := range playbook.WebhookOnCreationURLs {
			var parsedURL *url.URL
			parsedURL, err = url.ParseRequestURI(webhook)
			if err != nil {
				h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid creation webhook URL", err)
				return
			}

			if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
				msg := fmt.Sprintf("protocol in creation webhook URL is %s; only HTTP and HTTPS are accepted", parsedURL.Scheme)
				h.HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
				return
			}
		}
	}

	if playbook.WebhookOnStatusUpdateEnabled {
		for _, webhook := range playbook.WebhookOnStatusUpdateURLs {
			var parsedURL *url.URL
			parsedURL, err = url.ParseRequestURI(webhook)
			if err != nil {
				h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid update webhook URL", err)
				return
			}

			if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
				msg := fmt.Sprintf("protocol in update webhook URL is %s; only HTTP and HTTPS are accepted", parsedURL.Scheme)
				h.HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
				return
			}
		}
	}

	if playbook.CategorizeChannelEnabled {
		if err = h.validateCategoryName(playbook.CategoryName); err != nil {
			h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid category name", err)
			return
		}
	}

	if len(playbook.SignalAnyKeywords) != 0 {
		playbook.SignalAnyKeywords = removeDuplicates(playbook.SignalAnyKeywords)
	}

	err = h.playbookService.Update(playbook, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookHandler) archivePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookToArchive, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.DeletePlaybook(userID, playbookToArchive)) {
		return
	}

	err = h.playbookService.Archive(playbookToArchive, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookHandler) restorePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookToRestore, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.DeletePlaybook(userID, playbookToRestore)) {
		return
	}

	err = h.playbookService.Restore(playbookToRestore, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookHandler) getPlaybooks(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	teamID := params.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")
	opts, err := parseGetPlaybooksOptions(r.URL)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, fmt.Sprintf("failed to get playbooks: %s", err.Error()), nil)
		return
	}

	if teamID != "" && !h.PermissionsCheck(w, h.permissions.PlaybookList(userID, teamID)) {
		return
	}

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  teamID,
		IsAdmin: app.IsSystemAdmin(userID, h.pluginAPI),
	}

	playbookResults, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, opts)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, playbookResults, http.StatusOK)
}

func (h *PlaybookHandler) getPlaybooksAutoComplete(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	teamID := query.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, h.permissions.PlaybookList(userID, teamID)) {
		return
	}

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  teamID,
		IsAdmin: app.IsSystemAdmin(userID, h.pluginAPI),
	}

	playbooksResult, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, app.PlaybookFilterOptions{
		Page:         0,
		PerPage:      maxPlaybooksToAutocomplete,
		WithArchived: query.Get("with_archived") == "true",
	})
	if err != nil {
		h.HandleError(w, err)
		return
	}

	list := make([]model.AutocompleteListItem, 0)

	for _, playbook := range playbooksResult.Items {
		list = append(list, model.AutocompleteListItem{
			Item:     playbook.ID,
			HelpText: playbook.Title,
		})
	}

	ReturnJSON(w, list, http.StatusOK)
}

func parseGetPlaybooksOptions(u *url.URL) (app.PlaybookFilterOptions, error) {
	params := u.Query()

	var sortField app.SortField
	param := strings.ToLower(params.Get("sort"))
	switch param {
	case "title", "":
		sortField = app.SortByTitle
	case "stages":
		sortField = app.SortByStages
	case "steps":
		sortField = app.SortBySteps
	case "runs":
		sortField = app.SortByRuns
	default:
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'sort' (%s): it should be empty or one of 'title', 'stages' or 'steps'", param)
	}

	var sortDirection app.SortDirection
	param = strings.ToLower(params.Get("direction"))
	switch param {
	case "asc", "":
		sortDirection = app.DirectionAsc
	case "desc":
		sortDirection = app.DirectionDesc
	default:
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'direction' (%s): it should be empty or one of 'asc' or 'desc'", param)
	}

	pageParam := params.Get("page")
	if pageParam == "" {
		pageParam = "0"
	}
	page, err := strconv.Atoi(pageParam)
	if err != nil {
		return app.PlaybookFilterOptions{}, errors.Wrapf(err, "bad parameter 'page': it should be a number")
	}
	if page < 0 {
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'page': it should be a positive number")
	}

	perPageParam := params.Get("per_page")
	if perPageParam == "" || perPageParam == "0" {
		perPageParam = "1000"
	}
	perPage, err := strconv.Atoi(perPageParam)
	if err != nil {
		return app.PlaybookFilterOptions{}, errors.Wrapf(err, "bad parameter 'per_page': it should be a number")
	}
	if perPage < 0 {
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'per_page': it should be a positive number")
	}

	searchTerm := u.Query().Get("search_term")

	withArchived, _ := strconv.ParseBool(u.Query().Get("with_archived"))

	return app.PlaybookFilterOptions{
		Sort:         sortField,
		Direction:    sortDirection,
		Page:         page,
		PerPage:      perPage,
		SearchTerm:   searchTerm,
		WithArchived: withArchived,
	}, nil
}

func removeDuplicates(a []string) []string {
	items := make(map[string]bool)
	for _, item := range a {
		if item != "" {
			items[item] = true
		}
	}
	res := make([]string, 0, len(items))
	for item := range items {
		res = append(res, item)
	}
	return res
}

func (h *PlaybookHandler) validateCategoryName(categoryName string) error {
	categoryNameLength := len(categoryName)
	if categoryNameLength > 22 {
		msg := fmt.Sprintf("invalid category name: %s (maximum length is 22 characters)", categoryName)
		return errors.Errorf(msg)
	}
	return nil
}

func (h *PlaybookHandler) autoFollow(w http.ResponseWriter, r *http.Request) {
	playbookID := mux.Vars(r)["id"]
	currentUserID := r.Header.Get("Mattermost-User-ID")
	userID := mux.Vars(r)["userID"]

	if currentUserID != userID && !app.IsSystemAdmin(currentUserID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "User doesn't have permissions to make another user autofollow the playbook.", nil)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.PlaybookView(userID, playbookID)) {
		return
	}

	if err := h.playbookService.AutoFollow(playbookID, userID); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookHandler) autoUnfollow(w http.ResponseWriter, r *http.Request) {
	playbookID := mux.Vars(r)["id"]
	currentUserID := r.Header.Get("Mattermost-User-ID")
	userID := mux.Vars(r)["userID"]

	if currentUserID != userID && !app.IsSystemAdmin(currentUserID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "User doesn't have permissions to make another user autofollow the playbook.", nil)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.PlaybookView(userID, playbookID)) {
		return
	}

	if err := h.playbookService.AutoUnfollow(playbookID, userID); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookHandler) isAutoFollowing(w http.ResponseWriter, r *http.Request) {
	playbookID := mux.Vars(r)["id"]
	currentUserID := r.Header.Get("Mattermost-User-ID")
	userID := mux.Vars(r)["userID"]

	if currentUserID != userID && !app.IsSystemAdmin(currentUserID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Current user doesn't have permissions to check whether user is autofollowing or not.", nil)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.PlaybookView(userID, playbookID)) {
		return
	}

	isAutoFollowing, err := h.playbookService.IsAutoFollowing(playbookID, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, isAutoFollowing, http.StatusOK)
}

func (h *PlaybookHandler) exportPlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.PlaybookViewWithPlaybook(userID, playbook)) {
		return
	}

	export, err := app.GeneratePlaybookExport(playbook)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(export)
}

func (h *PlaybookHandler) duplicatePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.PlaybookViewWithPlaybook(userID, playbook)) {
		return
	}

	if !h.PermissionsCheck(w, h.permissions.PlaybookCreate(userID, playbook)) {
		return
	}

	newPlaybookID, err := h.playbookService.Duplicate(playbook, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: newPlaybookID,
	}
	ReturnJSON(w, &result, http.StatusCreated)
}

func (h *PlaybookHandler) importPlaybook(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	teamID := params.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")
	var importBlock struct {
		app.Playbook
		Version int `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&importBlock); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode playbook import", err)
		return
	}
	playbook := importBlock.Playbook

	if playbook.ID != "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "playbook import should not have ID field", nil)
		return
	}

	if importBlock.Version != app.CurrentPlaybookExportVersion {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Unsupported import version", nil)
		return
	}

	// Make the importer the sole admin of the playbook.
	playbook.Members = []app.PlaybookMember{
		{
			UserID: userID,
			Roles:  []string{app.PlaybookRoleMember, app.PlaybookRoleAdmin},
		},
	}

	if teamID != "" {
		playbook.TeamID = teamID
	}

	if !h.PermissionsCheck(w, h.permissions.PlaybookCreate(userID, playbook)) {
		return
	}

	if !h.validPlaybookCreation(w, &playbook) {
		return
	}

	id, err := h.playbookService.Import(playbook, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: id,
	}
	w.Header().Add("Location", makeAPIURL(h.pluginAPI, "playbooks/%s", id))

	ReturnJSON(w, &result, http.StatusCreated)
}

func (h *PlaybookHandler) validateMetrics(pb app.Playbook) error {
	if len(pb.Metrics) > app.MaxMetricsPerPlaybook {
		return errors.Errorf(fmt.Sprintf("playbook cannot have more than %d key metrics", app.MaxMetricsPerPlaybook))
	}

	//check if titles are unique
	titles := make(map[string]bool)
	for _, m := range pb.Metrics {
		if titles[m.Title] {
			return errors.Errorf("metrics names must be unique")
		}
		titles[m.Title] = true
	}
	return nil
}
