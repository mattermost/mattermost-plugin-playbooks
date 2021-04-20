package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/permissions"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

const (
	playbookCreatedWSEvent = "playbook_created"
	playbookDeletedWSEvent = "playbook_deleted"
)

// PlaybookHandler is the API handler.
type PlaybookHandler struct {
	playbookService playbook.Service
	pluginAPI       *pluginapi.Client
	poster          bot.Poster
	log             bot.Logger
	config          config.Service
}

// NewPlaybookHandler returns a new playbook api handler
func NewPlaybookHandler(router *mux.Router, playbookService playbook.Service, api *pluginapi.Client, poster bot.Poster, log bot.Logger, configService config.Service) *PlaybookHandler {
	handler := &PlaybookHandler{
		playbookService: playbookService,
		pluginAPI:       api,
		poster:          poster,
		log:             log,
		config:          configService,
	}

	playbooksRouter := router.PathPrefix("/playbooks").Subrouter()
	if !config.PricingPlanDifferentiationEnabled {
		e20Middleware := E20LicenseRequired{configService}
		playbooksRouter.Use(e20Middleware.Middleware)
	}

	playbooksRouter.HandleFunc("", handler.createPlaybook).Methods(http.MethodPost)
	playbooksRouter.HandleFunc("", handler.getPlaybooks).Methods(http.MethodGet)
	playbooksRouter.HandleFunc("/autocomplete", handler.getPlaybooksAutoComplete).Methods(http.MethodGet)
	playbooksRouter.HandleFunc("/count", handler.getPlaybookCount).Methods(http.MethodGet)

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
		HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode playbook", err)
		return
	}

	if !permissions.IsOnEnabledTeam(pbook.TeamID, h.config) {
		HandleErrorWithCode(w, http.StatusBadRequest, "not enabled on this team", nil)
		return
	}

	if pbook.ID != "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "Playbook given already has ID", nil)
		return
	}

	if pbook.BroadcastChannelID != "" &&
		!h.pluginAPI.User.HasPermissionToChannel(userID, pbook.BroadcastChannelID, model.PERMISSION_CREATE_POST) {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to create posts in the channel %s",
			userID,
			pbook.BroadcastChannelID,
		))
		return
	}

	if !permissions.CanViewTeam(userID, pbook.TeamID, h.pluginAPI) {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to create playbook on teamID %s",
			userID,
			pbook.TeamID,
		))
		return
	}

	for _, userID := range pbook.InvitedUserIDs {
		if !h.pluginAPI.User.HasPermissionToTeam(userID, pbook.TeamID, model.PERMISSION_VIEW_TEAM) {
			HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
				"invited user with ID %s does not have permission to playbook's team %s",
				userID,
				pbook.TeamID,
			))
			return
		}
	}

	for _, groupID := range pbook.InvitedGroupIDs {
		group, err := h.pluginAPI.Group.Get(groupID)
		if err != nil {
			HandleErrorWithCode(w, http.StatusBadRequest, "invalid group", err)
			return
		}

		if !group.AllowReference {
			HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
				"group %s does now allow references",
				groupID,
			))
			return
		}
	}

	if pbook.AnnouncementChannelID != "" &&
		!h.pluginAPI.User.HasPermissionToChannel(userID, pbook.AnnouncementChannelID, model.PERMISSION_CREATE_POST) {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to create posts in the channel %s",
			userID,
			pbook.AnnouncementChannelID,
		))
		return
	}

	if pbook.WebhookOnCreationURL != "" {
		url, err := url.ParseRequestURI(pbook.WebhookOnCreationURL)
		if err != nil {
			HandleErrorWithCode(w, http.StatusBadRequest, "invalid creation webhook URL", err)
			return
		}

		if url.Scheme != "http" && url.Scheme != "https" {
			msg := fmt.Sprintf("protocol in creation webhook URL is %s; only HTTP and HTTPS are accepted", url.Scheme)
			HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
			return
		}
	}

	// Exclude guest users
	if isGuest, err := permissions.IsGuest(userID, h.pluginAPI); err != nil {
		HandleError(w, err)
		return
	} else if isGuest {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to create playbook on teamID %s because they are a guest",
			userID,
			pbook.TeamID,
		))
		return
	}

	id, err := h.playbookService.Create(pbook, userID)
	if err != nil {
		HandleError(w, err)
		return
	}

	h.poster.PublishWebsocketEventToTeam(playbookCreatedWSEvent, map[string]interface{}{
		"teamID": pbook.TeamID,
	}, pbook.TeamID)

	result := struct {
		ID string `json:"id"`
	}{
		ID: id,
	}
	w.Header().Add("Location", fmt.Sprintf("/api/v0/playbooks/%s", pbook.ID))
	ReturnJSON(w, &result, http.StatusCreated)
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

	ReturnJSON(w, &pbook, http.StatusOK)
}

func (h *PlaybookHandler) updatePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	var pbook playbook.Playbook
	if err := json.NewDecoder(r.Body).Decode(&pbook); err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode playbook", err)
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

	if pbook.BroadcastChannelID != "" &&
		pbook.BroadcastChannelID != oldPlaybook.BroadcastChannelID &&
		!h.pluginAPI.User.HasPermissionToChannel(userID, pbook.BroadcastChannelID, model.PERMISSION_CREATE_POST) {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to create posts in the channel %s",
			userID,
			pbook.BroadcastChannelID,
		))
		return
	}

	filteredUsers := []string{}
	for _, userID := range pbook.InvitedUserIDs {
		if !h.pluginAPI.User.HasPermissionToTeam(userID, pbook.TeamID, model.PERMISSION_VIEW_TEAM) {
			h.pluginAPI.Log.Warn("user does not have permissions to playbook's team, removing from automated invite list", "teamID", pbook.TeamID, "userID", userID)
			continue
		}
		filteredUsers = append(filteredUsers, userID)
	}
	pbook.InvitedUserIDs = filteredUsers

	filteredGroups := []string{}
	for _, groupID := range pbook.InvitedGroupIDs {
		var group *model.Group
		group, err = h.pluginAPI.Group.Get(groupID)
		if err != nil {
			h.pluginAPI.Log.Warn("failed to query group", "group_id", groupID)
			continue
		}

		if !group.AllowReference {
			h.pluginAPI.Log.Warn("group does not allow references, removing from automated invite list", "group_id", groupID)
			continue
		}

		filteredGroups = append(filteredGroups, groupID)
	}
	pbook.InvitedGroupIDs = filteredGroups

	if pbook.DefaultCommanderID != "" && !permissions.IsMemberOfTeamID(pbook.DefaultCommanderID, pbook.TeamID, h.pluginAPI) {
		h.pluginAPI.Log.Warn("commander is not a member of the playbook's team, disabling default commander", "teamID", pbook.TeamID, "userID", pbook.DefaultCommanderID)
		pbook.DefaultCommanderID = ""
		pbook.DefaultCommanderEnabled = false
	}

	if pbook.AnnouncementChannelID != "" &&
		!h.pluginAPI.User.HasPermissionToChannel(userID, pbook.AnnouncementChannelID, model.PERMISSION_CREATE_POST) {
		h.pluginAPI.Log.Warn("announcement channel is not valid, disabling announcement channel setting")
		pbook.AnnouncementChannelID = ""
		pbook.AnnouncementChannelEnabled = false
	}

	if pbook.WebhookOnCreationURL != "" {
		url, err2 := url.ParseRequestURI(pbook.WebhookOnCreationURL)
		if err2 != nil {
			HandleErrorWithCode(w, http.StatusBadRequest, "invalid creation webhook URL", err2)
			return
		}

		if url.Scheme != "http" && url.Scheme != "https" {
			msg := fmt.Sprintf("protocol in creation webhook URL is %s; only HTTP and HTTPS are accepted", url.Scheme)
			HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
			return
		}
	}

	err = h.playbookService.Update(pbook, userID)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
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

	err = h.playbookService.Delete(playbookToDelete, userID)
	if err != nil {
		HandleError(w, err)
		return
	}

	h.poster.PublishWebsocketEventToTeam(playbookDeletedWSEvent, map[string]interface{}{
		"teamID": playbookToDelete.TeamID,
	}, playbookToDelete.TeamID)

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookHandler) getPlaybooks(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	teamID := params.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")
	opts, err := parseGetPlaybooksOptions(r.URL)
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, fmt.Sprintf("failed to get playbooks: %s", err.Error()), nil)
		return
	}
	memberOnly, _ := strconv.ParseBool(params.Get("member_only"))

	if teamID == "" {
		HandleErrorWithCode(w, http.StatusBadRequest, "Provide a team ID", nil)
		return
	}

	if !permissions.CanViewTeam(userID, teamID, h.pluginAPI) {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to get playbooks on teamID %s",
			userID,
			teamID,
		))
		return
	}

	// Exclude guest users
	if isGuest, errg := permissions.IsGuest(userID, h.pluginAPI); errg != nil {
		HandleError(w, errg)
		return
	} else if isGuest {
		HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to get playbooks on teamID %s because they are a guest",
			userID,
			teamID,
		))
		return
	}

	requesterInfo := playbook.RequesterInfo{
		UserID:          userID,
		TeamID:          teamID,
		UserIDtoIsAdmin: map[string]bool{userID: permissions.IsAdmin(userID, h.pluginAPI)},
		MemberOnly:      memberOnly,
	}

	playbookResults, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, opts)
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, playbookResults, http.StatusOK)
}

func (h *PlaybookHandler) getPlaybooksAutoComplete(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	teamID := query.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")

	if !permissions.CanViewTeam(userID, teamID, h.pluginAPI) {
		HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions to view team", nil)
		return
	}

	requesterInfo := playbook.RequesterInfo{
		UserID:          userID,
		TeamID:          teamID,
		UserIDtoIsAdmin: map[string]bool{userID: permissions.IsAdmin(userID, h.pluginAPI)},
		MemberOnly:      true,
	}

	playbooksResult, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, playbook.Options{})
	if err != nil {
		HandleError(w, err)
		return
	}

	list := make([]model.AutocompleteListItem, 0)

	for _, thePlaybook := range playbooksResult.Items {
		list = append(list, model.AutocompleteListItem{
			Item:     thePlaybook.ID,
			HelpText: thePlaybook.Title,
		})
	}

	ReturnJSON(w, list, http.StatusOK)
}

func (h *PlaybookHandler) getPlaybookCount(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	teamID := query.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")

	if !permissions.CanViewTeam(userID, teamID, h.pluginAPI) {
		HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions to view team", nil)
		return
	}

	count, err := h.playbookService.GetNumPlaybooksForTeam(teamID)
	if err != nil {
		HandleError(w, err)
		return
	}

	countStruct := struct {
		Count int `json:"count"`
	}{count}

	ReturnJSON(w, countStruct, http.StatusOK)
}

func (h *PlaybookHandler) hasPermissionsToPlaybook(thePlaybook playbook.Playbook, userID string) bool {
	if !permissions.CanViewTeam(userID, thePlaybook.TeamID, h.pluginAPI) {
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
		sortDirection = playbook.DirectionAsc
	case "desc":
		sortDirection = playbook.DirectionDesc
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
