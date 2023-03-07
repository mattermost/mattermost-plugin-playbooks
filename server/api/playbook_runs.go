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
	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// PlaybookRunHandler is the API handler.
type PlaybookRunHandler struct {
	*ErrorHandler
	config             config.Service
	playbookRunService app.PlaybookRunService
	playbookService    app.PlaybookService
	permissions        *app.PermissionsService
	licenseChecker     app.LicenseChecker
	pluginAPI          *pluginapi.Client
	poster             bot.Poster
	log                bot.Logger
}

// NewPlaybookRunHandler Creates a new Plugin API handler.
func NewPlaybookRunHandler(
	router *mux.Router,
	playbookRunService app.PlaybookRunService,
	playbookService app.PlaybookService,
	permissions *app.PermissionsService,
	licenseChecker app.LicenseChecker,
	api *pluginapi.Client,
	poster bot.Poster,
	log bot.Logger,
	configService config.Service,
) *PlaybookRunHandler {
	handler := &PlaybookRunHandler{
		ErrorHandler:       &ErrorHandler{log: log},
		playbookRunService: playbookRunService,
		playbookService:    playbookService,
		pluginAPI:          api,
		poster:             poster,
		log:                log,
		config:             configService,
		permissions:        permissions,
		licenseChecker:     licenseChecker,
	}

	playbookRunsRouter := router.PathPrefix("/runs").Subrouter()
	playbookRunsRouter.HandleFunc("", handler.getPlaybookRuns).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("", handler.createPlaybookRunFromPost).Methods(http.MethodPost)

	playbookRunsRouter.HandleFunc("/dialog", handler.createPlaybookRunFromDialog).Methods(http.MethodPost)
	playbookRunsRouter.HandleFunc("/add-to-timeline-dialog", handler.addToTimelineDialog).Methods(http.MethodPost)
	playbookRunsRouter.HandleFunc("/owners", handler.getOwners).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/channels", handler.getChannels).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/checklist-autocomplete", handler.getChecklistAutocomplete).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/checklist-autocomplete-item", handler.getChecklistAutocompleteItem).Methods(http.MethodGet)

	playbookRunRouter := playbookRunsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	playbookRunRouter.HandleFunc("", handler.getPlaybookRun).Methods(http.MethodGet)
	playbookRunRouter.HandleFunc("/metadata", handler.getPlaybookRunMetadata).Methods(http.MethodGet)

	playbookRunRouterAuthorized := playbookRunRouter.PathPrefix("").Subrouter()
	playbookRunRouterAuthorized.Use(handler.checkEditPermissions)
	playbookRunRouterAuthorized.HandleFunc("", handler.updatePlaybookRun).Methods(http.MethodPatch)
	playbookRunRouterAuthorized.HandleFunc("/owner", handler.changeOwner).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/status", handler.status).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/finish", handler.finish).Methods(http.MethodPut)
	playbookRunRouterAuthorized.HandleFunc("/finish-dialog", handler.finishDialog).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/update-status-dialog", handler.updateStatusDialog).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/reminder/button-update", handler.reminderButtonUpdate).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/reminder", handler.reminderReset).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/no-retrospective-button", handler.noRetrospectiveButton).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/timeline/{eventID:[A-Za-z0-9]+}", handler.removeTimelineEvent).Methods(http.MethodDelete)
	playbookRunRouterAuthorized.HandleFunc("/update-description", handler.updateDescription).Methods(http.MethodPut)
	playbookRunRouterAuthorized.HandleFunc("/restore", handler.restore).Methods(http.MethodPut)
	playbookRunRouterAuthorized.HandleFunc("/actions", handler.updateRunActions).Methods(http.MethodPut)

	channelRouter := playbookRunsRouter.PathPrefix("/channel").Subrouter()
	channelRouter.HandleFunc("/{channel_id:[A-Za-z0-9]+}", handler.getPlaybookRunByChannel).Methods(http.MethodGet)

	checklistsRouter := playbookRunRouterAuthorized.PathPrefix("/checklists").Subrouter()
	checklistsRouter.HandleFunc("", handler.addChecklist).Methods(http.MethodPost)
	checklistsRouter.HandleFunc("/move", handler.moveChecklist).Methods(http.MethodPost)
	checklistsRouter.HandleFunc("/move-item", handler.moveChecklistItem).Methods(http.MethodPost)

	checklistRouter := checklistsRouter.PathPrefix("/{checklist:[0-9]+}").Subrouter()
	checklistRouter.HandleFunc("", handler.removeChecklist).Methods(http.MethodDelete)
	checklistRouter.HandleFunc("/add", handler.addChecklistItem).Methods(http.MethodPost)
	checklistRouter.HandleFunc("/rename", handler.renameChecklist).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/add-dialog", handler.addChecklistItemDialog).Methods(http.MethodPost)
	checklistRouter.HandleFunc("/skip", handler.checklistSkip).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/restore", handler.checklistRestore).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/duplicate", handler.duplicateChecklist).Methods(http.MethodPost)

	checklistItem := checklistRouter.PathPrefix("/item/{item:[0-9]+}").Subrouter()
	checklistItem.HandleFunc("", handler.itemDelete).Methods(http.MethodDelete)
	checklistItem.HandleFunc("", handler.itemEdit).Methods(http.MethodPut)
	checklistItem.HandleFunc("/skip", handler.itemSkip).Methods(http.MethodPut)
	checklistItem.HandleFunc("/restore", handler.itemRestore).Methods(http.MethodPut)
	checklistItem.HandleFunc("/state", handler.itemSetState).Methods(http.MethodPut)
	checklistItem.HandleFunc("/assignee", handler.itemSetAssignee).Methods(http.MethodPut)
	checklistItem.HandleFunc("/command", handler.itemSetCommand).Methods(http.MethodPut)
	checklistItem.HandleFunc("/run", handler.itemRun).Methods(http.MethodPost)
	checklistItem.HandleFunc("/duplicate", handler.itemDuplicate).Methods(http.MethodPost)
	checklistItem.HandleFunc("/duedate", handler.itemSetDueDate).Methods(http.MethodPut)

	retrospectiveRouter := playbookRunRouterAuthorized.PathPrefix("/retrospective").Subrouter()
	retrospectiveRouter.HandleFunc("", handler.updateRetrospective).Methods(http.MethodPost)
	retrospectiveRouter.HandleFunc("/publish", handler.publishRetrospective).Methods(http.MethodPost)

	followersRouter := playbookRunRouter.PathPrefix("/followers").Subrouter()
	followersRouter.HandleFunc("", handler.follow).Methods(http.MethodPut)
	followersRouter.HandleFunc("", handler.unfollow).Methods(http.MethodDelete)
	followersRouter.HandleFunc("", handler.getFollowers).Methods(http.MethodGet)

	return handler
}

func (h *PlaybookRunHandler) checkEditPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		playbookRun, err := h.playbookRunService.GetPlaybookRun(vars["id"])
		if err != nil {
			h.HandleError(w, err)
			return
		}

		if !h.PermissionsCheck(w, h.permissions.RunManageProperties(userID, playbookRun.ID)) {
			return
		}

		next.ServeHTTP(w, r)
	})
}

// createPlaybookRunFromPost handles the POST /runs endpoint
func (h *PlaybookRunHandler) createPlaybookRunFromPost(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var playbookRunCreateOptions client.PlaybookRunCreateOptions
	if err := json.NewDecoder(r.Body).Decode(&playbookRunCreateOptions); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode playbook run create options", err)
		return
	}

	playbookRun, err := h.createPlaybookRun(
		app.PlaybookRun{
			OwnerUserID: playbookRunCreateOptions.OwnerUserID,
			TeamID:      playbookRunCreateOptions.TeamID,
			ChannelID:   playbookRunCreateOptions.ChannelID,
			Name:        playbookRunCreateOptions.Name,
			Summary:     playbookRunCreateOptions.Description,
			PostID:      playbookRunCreateOptions.PostID,
			PlaybookID:  playbookRunCreateOptions.PlaybookID,
		},
		userID,
	)

	if errors.Is(err, app.ErrNoPermissions) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "unable to create playbook run", err)
		return
	}

	if errors.Is(err, app.ErrMalformedPlaybookRun) {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to create playbook run", err)
		return
	}

	if err != nil {
		h.HandleError(w, errors.Wrapf(err, "unable to create playbook run"))
		return
	}

	h.poster.PublishWebsocketEventToUser(app.PlaybookRunCreatedWSEvent, map[string]interface{}{
		"playbook_run": playbookRun,
	}, userID)

	w.Header().Add("Location", fmt.Sprintf("/api/v0/runs/%s", playbookRun.ID))
	ReturnJSON(w, &playbookRun, http.StatusCreated)
}

// Note that this currently does nothing. This is temporary given the removal of stages. Will be used by status.
func (h *PlaybookRunHandler) updatePlaybookRun(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	//userID := r.Header.Get("Mattermost-User-ID")

	oldPlaybookRun, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	var updates app.UpdateOptions
	if err = json.NewDecoder(r.Body).Decode(&updates); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	updatedPlaybookRun := oldPlaybookRun

	ReturnJSON(w, updatedPlaybookRun, http.StatusOK)
}

// createPlaybookRunFromDialog handles the interactive dialog submission when a user presses confirm on
// the create playbook run dialog.
func (h *PlaybookRunHandler) createPlaybookRunFromDialog(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var request *model.SubmitDialogRequest
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", err)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	var state app.DialogState
	err = json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal dialog state", err)
		return
	}

	var playbookID, name string
	if rawPlaybookID, ok := request.Submission[app.DialogFieldPlaybookIDKey].(string); ok {
		playbookID = rawPlaybookID
	}
	if rawName, ok := request.Submission[app.DialogFieldNameKey].(string); ok {
		name = rawName
	}

	playbookRun, err := h.createPlaybookRun(
		app.PlaybookRun{
			OwnerUserID: request.UserId,
			TeamID:      request.TeamId,
			Name:        name,
			PostID:      state.PostID,
			PlaybookID:  playbookID,
		},
		request.UserId,
	)
	if err != nil {
		if errors.Is(err, app.ErrMalformedPlaybookRun) {
			h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to create playbook run", err)
			return
		}

		if errors.Is(err, app.ErrNoPermissions) {
			h.HandleErrorWithCode(w, http.StatusForbidden, "not authorized to make runs from this playbook", err)
			return
		}

		var msg string

		if errors.Is(err, app.ErrChannelDisplayNameInvalid) {
			msg = "The name is invalid or too long. Please use a valid name with fewer than 64 characters."
		}

		if msg != "" {
			resp := &model.SubmitDialogResponse{
				Errors: map[string]string{
					app.DialogFieldNameKey: msg,
				},
			}
			respBytes, _ := json.Marshal(resp)
			_, _ = w.Write(respBytes)
			return
		}

		h.HandleError(w, err)
		return
	}

	channel, err := h.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to get new channel", err)
		return
	}

	// Delay sending the websocket message because the front end may try to change to the newly created
	// channel, and the server may respond with a "channel not found" error. This happens in e2e tests,
	// and possibly in the wild.
	go func() {
		time.Sleep(1 * time.Second) // arbitrary 1 second magic number

		h.poster.PublishWebsocketEventToUser(app.PlaybookRunCreatedWSEvent, map[string]interface{}{
			"client_id":    state.ClientID,
			"playbook_run": playbookRun,
			"channel_name": channel.Name,
		}, request.UserId)
	}()

	if err := h.postPlaybookRunCreatedMessage(playbookRun, request.ChannelId); err != nil {
		h.HandleError(w, err)
		return
	}

	w.Header().Add("Location", fmt.Sprintf("/api/v0/runs/%s", playbookRun.ID))
	w.WriteHeader(http.StatusCreated)
}

// addToTimelineDialog handles the interactive dialog submission when a user clicks the
// corresponding post action.
func (h *PlaybookRunHandler) addToTimelineDialog(w http.ResponseWriter, r *http.Request) {
	if !h.licenseChecker.TimelineAllowed() {
		h.HandleErrorWithCode(w, http.StatusForbidden, "timeline feature is not covered by current server license", nil)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")

	var request *model.SubmitDialogRequest
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", err)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	var playbookRunID, summary string
	if rawPlaybookRunID, ok := request.Submission[app.DialogFieldPlaybookRunKey].(string); ok {
		playbookRunID = rawPlaybookRunID
	}
	if rawSummary, ok := request.Submission[app.DialogFieldSummary].(string); ok {
		summary = rawSummary
	}

	playbookRun, incErr := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if incErr != nil {
		h.HandleError(w, incErr)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.RunManageProperties(userID, playbookRun.ID)) {
		return
	}

	var state app.DialogStateAddToTimeline
	err = json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal dialog state", err)
		return
	}

	if err = h.playbookRunService.AddPostToTimeline(playbookRunID, userID, state.PostID, summary); err != nil {
		h.HandleError(w, errors.Wrap(err, "failed to add post to timeline"))
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) createPlaybookRun(playbookRun app.PlaybookRun, userID string) (*app.PlaybookRun, error) {
	if playbookRun.ID != "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook run already has an id")
	}

	if playbookRun.CreateAt != 0 {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook run channel already has created at date")
	}

	if playbookRun.TeamID == "" && playbookRun.ChannelID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "must provide team or channel to create playbook run")
	}

	// If a channel is specified, ensure it's from the given team (if one provided), or
	// just grab the team for that channel.
	var channel *model.Channel
	var err error
	if playbookRun.ChannelID != "" {
		channel, err = h.pluginAPI.Channel.Get(playbookRun.ChannelID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get channel")
		}

		if playbookRun.TeamID == "" {
			playbookRun.TeamID = channel.TeamId
		} else if channel.TeamId != playbookRun.TeamID {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "channel not in given team")
		}
	}

	if playbookRun.OwnerUserID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing owner user id of playbook run")
	}

	if strings.TrimSpace(playbookRun.Name) == "" && playbookRun.ChannelID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing name of playbook run")
	}

	public := true
	var playbook *app.Playbook
	if playbookRun.PlaybookID != "" {
		pb, err := h.playbookService.Get(playbookRun.PlaybookID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook")
		}

		if pb.DeleteAt != 0 {
			return nil, errors.New("playbook is archived, cannot create a new run using an archived playbook")
		}

		if err := h.permissions.RunCreate(userID, pb); err != nil {
			return nil, err
		}

		h.setPlaybookRunChecklist(&playbookRun, &pb)
		public = pb.CreatePublicPlaybookRun

		if pb.RunSummaryTemplateEnabled {
			playbookRun.Summary = pb.RunSummaryTemplate
		}
		playbookRun.ReminderMessageTemplate = pb.ReminderMessageTemplate
		playbookRun.StatusUpdateEnabled = pb.StatusUpdateEnabled
		playbookRun.PreviousReminder = time.Duration(pb.ReminderTimerDefaultSeconds) * time.Second
		playbookRun.ReminderTimerDefaultSeconds = pb.ReminderTimerDefaultSeconds

		playbookRun.InvitedUserIDs = []string{}
		playbookRun.InvitedGroupIDs = []string{}
		if pb.InviteUsersEnabled {
			playbookRun.InvitedUserIDs = pb.InvitedUserIDs
			playbookRun.InvitedGroupIDs = pb.InvitedGroupIDs
		}

		if pb.DefaultOwnerEnabled {
			playbookRun.DefaultOwnerID = pb.DefaultOwnerID
		}

		playbookRun.StatusUpdateBroadcastChannelsEnabled = pb.BroadcastEnabled
		playbookRun.BroadcastChannelIDs = pb.BroadcastChannelIDs

		playbookRun.WebhookOnCreationURLs = []string{}
		if pb.WebhookOnCreationEnabled {
			playbookRun.WebhookOnCreationURLs = pb.WebhookOnCreationURLs
		}

		playbookRun.StatusUpdateBroadcastWebhooksEnabled = pb.WebhookOnStatusUpdateEnabled
		playbookRun.WebhookOnStatusUpdateURLs = pb.WebhookOnStatusUpdateURLs

		playbookRun.RetrospectiveEnabled = pb.RetrospectiveEnabled
		if pb.RetrospectiveEnabled {
			playbookRun.RetrospectiveReminderIntervalSeconds = pb.RetrospectiveReminderIntervalSeconds
			playbookRun.Retrospective = pb.RetrospectiveTemplate
		}

		playbook = &pb
	}

	if channel == nil {
		permission := model.PermissionCreatePrivateChannel
		permissionMessage := "You are not able to create a private channel"
		if public {
			permission = model.PermissionCreatePublicChannel
			permissionMessage = "You are not able to create a public channel"
		}
		if !h.pluginAPI.User.HasPermissionToTeam(userID, playbookRun.TeamID, permission) {
			return nil, errors.Wrap(app.ErrNoPermissions, permissionMessage)
		}
	} else {
		permission := model.PermissionManagePublicChannelProperties
		permissionMessage := "You are not able to manage public channel properties"
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelProperties
			permissionMessage = "You are not able to manage private channel properties"
		} else if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
			permission = model.PermissionReadChannel
			permissionMessage = "You do not have access to this channel"
		}

		if !h.pluginAPI.User.HasPermissionToChannel(userID, channel.Id, permission) {
			return nil, errors.Wrap(app.ErrNoPermissions, permissionMessage)
		}
	}

	if playbookRun.PostID != "" {
		post, err := h.pluginAPI.Post.GetPost(playbookRun.PostID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook run original post")
		}
		if !h.pluginAPI.User.HasPermissionToChannel(userID, post.ChannelId, model.PermissionReadChannel) {
			return nil, errors.New("user does not have access to the channel containing the playbook run's original post")
		}
	}

	return h.playbookRunService.CreatePlaybookRun(&playbookRun, playbook, userID, public)
}

func (h *PlaybookRunHandler) setPlaybookRunChecklist(playbookRun *app.PlaybookRun, playbook *app.Playbook) {
	playbookRun.Checklists = playbook.Checklists

	// playbooks can only have due dates relative to when a run starts, so we should convert them to absolute timestamp
	now := model.GetMillis()
	for i := range playbookRun.Checklists {
		for j := range playbookRun.Checklists[i].Items {
			if playbookRun.Checklists[i].Items[j].DueDate > 0 {
				playbookRun.Checklists[i].Items[j].DueDate += now
			}
		}
	}
}

func (h *PlaybookRunHandler) getRequesterInfo(userID string) (app.RequesterInfo, error) {
	return app.GetRequesterInfo(userID, h.pluginAPI)
}

// getPlaybookRuns handles the GET /runs endpoint.
func (h *PlaybookRunHandler) getPlaybookRuns(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	filterOptions, err := parsePlaybookRunsFilterOptions(r.URL, userID)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	results, err := h.playbookRunService.GetPlaybookRuns(requesterInfo, *filterOptions)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, results, http.StatusOK)
}

// getPlaybookRun handles the /runs/{id} endpoint.
func (h *PlaybookRunHandler) getPlaybookRun(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	playbookRunToGet, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, playbookRunToGet, http.StatusOK)
}

// getPlaybookRunMetadata handles the /runs/{id}/metadata endpoint.
func (h *PlaybookRunHandler) getPlaybookRunMetadata(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	playbookRunMetadata, err := h.playbookRunService.GetPlaybookRunMetadata(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, playbookRunMetadata, http.StatusOK)
}

// getPlaybookRunByChannel handles the /runs/channel/{channel_id} endpoint.
func (h *PlaybookRunHandler) getPlaybookRunByChannel(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRunID, err := h.playbookRunService.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		if errors.Is(err, app.ErrNotFound) {
			h.HandleErrorWithCode(w, http.StatusNotFound, "Not found",
				errors.Errorf("playbook run for channel id %s not found", channelID))

			return
		}
		h.HandleError(w, err)
		return
	}

	if err := h.permissions.RunView(userID, playbookRunID); err != nil {
		h.log.Warnf("User %s does not have permissions to get playbook run %s for channel %s", userID, playbookRunID, channelID)
		h.HandleErrorWithCode(w, http.StatusNotFound, "Not found",
			errors.Errorf("playbook run for channel id %s not found", channelID))
		return
	}

	playbookRunToGet, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, playbookRunToGet, http.StatusOK)
}

// getOwners handles the /runs/owners api endpoint.
func (h *PlaybookRunHandler) getOwners(w http.ResponseWriter, r *http.Request) {
	teamID := r.URL.Query().Get("team_id")

	userID := r.Header.Get("Mattermost-User-ID")
	options := app.PlaybookRunFilterOptions{
		TeamID: teamID,
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	owners, err := h.playbookRunService.GetOwners(requesterInfo, options)
	if err != nil {
		h.HandleError(w, errors.Wrapf(err, "failed to get owners"))
		return
	}

	if owners == nil {
		owners = []app.OwnerInfo{}
	}

	ReturnJSON(w, owners, http.StatusOK)
}

func (h *PlaybookRunHandler) getChannels(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	filterOptions, err := parsePlaybookRunsFilterOptions(r.URL, userID)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	playbookRuns, err := h.playbookRunService.GetPlaybookRuns(requesterInfo, *filterOptions)
	if err != nil {
		h.HandleError(w, errors.Wrapf(err, "failed to get owners"))
		return
	}

	channelIds := make([]string, 0, len(playbookRuns.Items))
	for _, playbookRun := range playbookRuns.Items {
		channelIds = append(channelIds, playbookRun.ChannelID)
	}

	ReturnJSON(w, channelIds, http.StatusOK)
}

// changeOwner handles the /runs/{id}/change-owner api endpoint.
func (h *PlaybookRunHandler) changeOwner(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		OwnerID string `json:"owner_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "could not decode request body", err)
		return
	}

	playbookRun, err := h.playbookRunService.GetPlaybookRun(vars["id"])
	if err != nil {
		h.HandleError(w, err)
		return
	}

	// Check if the target user (params.OwnerID) has permissions
	if !h.PermissionsCheck(w, h.permissions.RunManageProperties(params.OwnerID, playbookRun.ID)) {
		return
	}

	if err := h.playbookRunService.ChangeOwner(vars["id"], userID, params.OwnerID); err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

// updateStatusD handles the POST /runs/{id}/status endpoint, user has edit permissions
func (h *PlaybookRunHandler) status(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRunToModify, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if !app.CanPostToChannel(userID, playbookRunToModify.ChannelID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", fmt.Errorf("user %s cannot post to playbook run channel %s", userID, playbookRunToModify.ChannelID))
		return
	}

	var options app.StatusUpdateOptions
	if err = json.NewDecoder(r.Body).Decode(&options); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode body into StatusUpdateOptions", err)
		return
	}

	if publicMsg, internalErr := h.updateStatus(playbookRunID, userID, options); internalErr != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, publicMsg, internalErr)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

// updateStatus returns a publicMessage and an internal error
func (h *PlaybookRunHandler) updateStatus(playbookRunID, userID string, options app.StatusUpdateOptions) (string, error) {
	options.Message = strings.TrimSpace(options.Message)
	if options.Message == "" {
		return "message must not be empty", errors.New("message field empty")
	}

	if options.Reminder <= 0 && !options.FinishRun {
		return "the reminder must be set and not 0", errors.New("reminder was 0")
	}
	if options.Reminder < 0 || options.FinishRun {
		options.Reminder = 0
	}
	options.Reminder = options.Reminder * time.Second

	if err := h.playbookRunService.UpdateStatus(playbookRunID, userID, options); err != nil {
		return "An internal error has occurred. Check app server logs for details.", err
	}

	if options.FinishRun {
		if err := h.playbookRunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
			return "An internal error has occurred. Check app server logs for details.", err
		}
	}

	return "", nil
}

// updateStatusD handles the POST /runs/{id}/finish endpoint, user has edit permissions
func (h *PlaybookRunHandler) finish(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

// restore "un-finishes" a playbook run
func (h *PlaybookRunHandler) restore(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RestorePlaybookRun(playbookRunID, userID); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

// updateRunActions modifies status update broadcast settings.
func (h *PlaybookRunHandler) updateRunActions(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")
	var params app.RunAction

	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal status update broadcast settings params state", err)
		return
	}

	if err := h.playbookRunService.UpdateRunActions(playbookRunID, userID, params); err != nil {
		h.HandleError(w, err)
		return
	}
}

// updateStatusDialog handles the POST /runs/{id}/finish-dialog endpoint, called when a
// user submits the Finish Run dialog.
func (h *PlaybookRunHandler) finishDialog(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRun, incErr := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if incErr != nil {
		h.HandleError(w, incErr)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.RunManageProperties(userID, playbookRun.ID)) {
		return
	}

	if err := h.playbookRunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
		h.HandleError(w, err)
		return
	}
}

// updateStatusDialog handles the POST /runs/{id}/update-status-dialog endpoint, called when a
// user submits the Update Status dialog.
func (h *PlaybookRunHandler) updateStatusDialog(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRunToModify, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if !app.CanPostToChannel(userID, playbookRunToModify.ChannelID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", fmt.Errorf("user %s cannot post to playbook run channel %s", userID, playbookRunToModify.ChannelID))
		return
	}

	var request *model.SubmitDialogRequest
	err = json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", err)
		return
	}

	var options app.StatusUpdateOptions
	if message, ok := request.Submission[app.DialogFieldMessageKey]; ok {
		options.Message = message.(string)
	}

	if reminderI, ok := request.Submission[app.DialogFieldReminderInSecondsKey]; ok {
		var reminder int
		reminder, err = strconv.Atoi(reminderI.(string))
		if err != nil {
			h.HandleError(w, err)
			return
		}
		options.Reminder = time.Duration(reminder)
	}

	if finishB, ok := request.Submission[app.DialogFieldFinishRun]; ok {
		var finish bool
		if finish, ok = finishB.(bool); ok {
			options.FinishRun = finish
		}
	}

	if publicMsg, internalErr := h.updateStatus(playbookRunID, userID, options); internalErr != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, publicMsg, internalErr)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// reminderButtonUpdate handles the POST /runs/{id}/reminder/button-update endpoint, called when a
// user clicks on the reminder interactive button
func (h *PlaybookRunHandler) reminderButtonUpdate(w http.ResponseWriter, r *http.Request) {
	var requestData *model.PostActionIntegrationRequest
	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil || requestData == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "missing request data", nil)
		return
	}

	playbookRunID, err := h.playbookRunService.GetPlaybookRunIDForChannel(requestData.ChannelId)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error getting playbook run",
			errors.Wrapf(err, "reminderButtonUpdate failed to find playbookRunID for channelID: %s", requestData.ChannelId))
		return
	}

	if !h.PermissionsCheck(w, h.permissions.RunManageProperties(requestData.UserId, playbookRunID)) {
		return
	}

	if err = h.playbookRunService.OpenUpdateStatusDialog(playbookRunID, requestData.TriggerId); err != nil {
		h.HandleError(w, errors.New("reminderButtonUpdate failed to open update status dialog"))
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// reminderButtonDismiss handles the POST /runs/{id}/reminder endpoint, called when a
// user clicks on the reminder custom_update_status time selector
func (h *PlaybookRunHandler) reminderReset(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")
	var payload struct {
		NewReminderSeconds int `json:"new_reminder_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.HandleError(w, err)
		return
	}

	if payload.NewReminderSeconds <= 0 {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "new_reminder_seconds must be > 0", errors.New("new_reminder_seconds was <= 0"))
		return
	}

	storedPlaybookRun, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		err = errors.Wrapf(err, "reminderReset: no playbook run for path's playbookRunID: %s", playbookRunID)
		h.HandleErrorWithCode(w, http.StatusBadRequest, "no playbook run for path's playbookRunID", err)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.RunManageProperties(userID, storedPlaybookRun.ID)) {
		return
	}

	if err = h.playbookRunService.SetNewReminder(playbookRunID, time.Duration(payload.NewReminderSeconds)*time.Second); err != nil {
		err = errors.Wrapf(err, "reminderReset: error setting new reminder for playbookRunID %s", playbookRunID)
		h.HandleErrorWithCode(w, http.StatusBadRequest, "error removing reminder post", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) noRetrospectiveButton(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRunToCancelRetro, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.RunManageProperties(userID, playbookRunToCancelRetro.ID)) {
		return
	}

	if err := h.playbookRunService.CancelRetrospective(playbookRunToCancelRetro.ID, userID); err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to cancel retrospective", err)
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// removeTimelineEvent handles the DELETE /runs/{id}/timeline/{eventID} endpoint.
// User has been authenticated to edit the playbook run.
func (h *PlaybookRunHandler) removeTimelineEvent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")
	eventID := vars["eventID"]

	if err := h.playbookRunService.RemoveTimelineEvent(id, userID, eventID); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) updateDescription(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRun, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	var requestBody struct {
		Description string `json:"description"`
	}

	if err2 := json.NewDecoder(r.Body).Decode(&requestBody); err2 != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode playbook run description", err2)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.RunManageProperties(userID, playbookRun.ID)) {
		return
	}

	if err := h.playbookRunService.UpdateDescription(playbookRunID, requestBody.Description); err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to update description", err)
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

func (h *PlaybookRunHandler) getChecklistAutocompleteItem(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, h.permissions.RunViewByChannel(userID, channelID)) {
		return
	}

	playbookRunID, err := h.playbookRunService.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	data, err := h.playbookRunService.GetChecklistItemAutocomplete(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *PlaybookRunHandler) getChecklistAutocomplete(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, h.permissions.RunViewByChannel(userID, channelID)) {
		return
	}

	playbookRunID, err := h.playbookRunService.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	data, err := h.playbookRunService.GetChecklistAutocomplete(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetState(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		NewState string `json:"new_state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if !app.IsValidChecklistItemState(params.NewState) {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter new state", nil)
		return
	}

	if err := h.playbookRunService.ModifyCheckedState(id, userID, params.NewState, checklistNum, itemNum); err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetAssignee(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		AssigneeID string `json:"assignee_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if err := h.playbookRunService.SetAssignee(id, userID, params.AssigneeID, checklistNum, itemNum); err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetDueDate(w http.ResponseWriter, r *http.Request) {
	if !h.licenseChecker.ChecklistItemDueDateAllowed() {
		h.HandleErrorWithCode(w, http.StatusForbidden, "checklist item due date feature is not covered by current server license", nil)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		DueDate int64 `json:"due_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if err := h.playbookRunService.SetDueDate(id, userID, params.DueDate, checklistNum, itemNum); err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetCommand(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if err := h.playbookRunService.SetCommandToChecklistItem(id, userID, checklistNum, itemNum, params.Command); err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemRun(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	triggerID, err := h.playbookRunService.RunChecklistItemSlashCommand(playbookRunID, userID, checklistNum, itemNum)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{"trigger_id": triggerID}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemDuplicate(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.DuplicateChecklistItem(playbookRunID, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) addChecklist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var checklist app.Checklist
	if err := json.NewDecoder(r.Body).Decode(&checklist); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode Checklist", err)
		return
	}

	checklist.Title = strings.TrimSpace(checklist.Title)
	if checklist.Title == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter: checklist title",
			errors.New("checklist title must not be blank"))
		return
	}

	if err := h.playbookRunService.AddChecklist(id, userID, checklist); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) removeChecklist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RemoveChecklist(id, userID, checklistNum); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) duplicateChecklist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.DuplicateChecklist(playbookRunID, userID, checklistNum); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) addChecklistItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var checklistItem app.ChecklistItem
	if err := json.NewDecoder(r.Body).Decode(&checklistItem); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode ChecklistItem", err)
		return
	}

	checklistItem.Title = strings.TrimSpace(checklistItem.Title)
	if checklistItem.Title == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter: checklist item title",
			errors.New("checklist item title must not be blank"))
		return
	}

	if err := h.playbookRunService.AddChecklistItem(id, userID, checklistNum, checklistItem); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// addChecklistItemDialog handles the interactive dialog submission when a user clicks add new task
func (h *PlaybookRunHandler) addChecklistItemDialog(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}

	var request *model.SubmitDialogRequest
	err = json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", err)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	var name, description string
	if rawName, ok := request.Submission[app.DialogFieldItemNameKey].(string); ok {
		name = rawName
	}
	if rawDescription, ok := request.Submission[app.DialogFieldItemDescriptionKey].(string); ok {
		description = rawDescription
	}

	checklistItem := app.ChecklistItem{
		Title:       name,
		Description: description,
	}

	checklistItem.Title = strings.TrimSpace(checklistItem.Title)
	if checklistItem.Title == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter: checklist item title",
			errors.New("checklist item title must not be blank"))
		return
	}

	if err := h.playbookRunService.AddChecklistItem(playbookRunID, userID, checklistNum, checklistItem); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)

}

func (h *PlaybookRunHandler) itemDelete(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RemoveChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) checklistSkip(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.SkipChecklist(id, userID, checklistNum); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) checklistRestore(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RestoreChecklist(id, userID, checklistNum); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) itemSkip(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.SkipChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) itemRestore(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RestoreChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) itemEdit(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Title       string `json:"title"`
		Command     string `json:"command"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal edit params state", err)
		return
	}

	if err := h.playbookRunService.EditChecklistItem(id, userID, checklistNum, itemNum, params.Title, params.Command, params.Description); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) renameChecklist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var modificationParams struct {
		NewTitle string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&modificationParams); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal new title", err)
		return
	}

	if modificationParams.NewTitle == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter: checklist title",
			errors.New("checklist title must not be blank"))
		return
	}

	if err := h.playbookRunService.RenameChecklist(id, userID, checklistNum, modificationParams.NewTitle); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) moveChecklist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		SourceChecklistIdx int `json:"source_checklist_idx"`
		DestChecklistIdx   int `json:"dest_checklist_idx"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal edit params", err)
		return
	}

	if err := h.playbookRunService.MoveChecklist(id, userID, params.SourceChecklistIdx, params.DestChecklistIdx); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) moveChecklistItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		SourceChecklistIdx int `json:"source_checklist_idx"`
		SourceItemIdx      int `json:"source_item_idx"`
		DestChecklistIdx   int `json:"dest_checklist_idx"`
		DestItemIdx        int `json:"dest_item_idx"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal edit params", err)
		return
	}

	if err := h.playbookRunService.MoveChecklistItem(id, userID, params.SourceChecklistIdx, params.SourceItemIdx, params.DestChecklistIdx, params.DestItemIdx); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) postPlaybookRunCreatedMessage(playbookRun *app.PlaybookRun, channelID string) error {
	channel, err := h.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		return err
	}

	post := &model.Post{
		Message: fmt.Sprintf("Playbook run %s started in ~%s", playbookRun.Name, channel.Name),
	}
	h.poster.EphemeralPost(playbookRun.OwnerUserID, channelID, post)

	return nil
}

func (h *PlaybookRunHandler) updateRetrospective(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var retroUpdate app.RetrospectiveUpdate

	if err := json.NewDecoder(r.Body).Decode(&retroUpdate); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	if err := h.playbookRunService.UpdateRetrospective(playbookRunID, userID, retroUpdate); err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to update retrospective", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) publishRetrospective(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var retroUpdate app.RetrospectiveUpdate

	if err := json.NewDecoder(r.Body).Decode(&retroUpdate); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	if err := h.playbookRunService.PublishRetrospective(playbookRunID, userID, retroUpdate); err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to publish retrospective", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) follow(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	if err := h.playbookRunService.Follow(playbookRunID, userID); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) unfollow(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.Unfollow(playbookRunID, userID); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) getFollowers(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	var followers []string
	var err error
	if followers, err = h.playbookRunService.GetFollowers(playbookRunID); err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, followers, http.StatusOK)
}

// parsePlaybookRunsFilterOptions is only for parsing. Put validation logic in app.validateOptions.
func parsePlaybookRunsFilterOptions(u *url.URL, currentUserID string) (*app.PlaybookRunFilterOptions, error) {
	teamID := u.Query().Get("team_id")

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

	// Parse statuses= query string parameters as an array.
	statuses := u.Query()["statuses"]

	ownerID := u.Query().Get("owner_user_id")
	if ownerID == client.Me {
		ownerID = currentUserID
	}

	searchTerm := u.Query().Get("search_term")

	participantID := u.Query().Get("participant_id")
	if participantID == client.Me {
		participantID = currentUserID
	}

	participantOrFollowerID := u.Query().Get("participant_or_follower_id")
	if participantOrFollowerID == client.Me {
		participantOrFollowerID = currentUserID
	}

	playbookID := u.Query().Get("playbook_id")

	activeGTEParam := u.Query().Get("active_gte")
	if activeGTEParam == "" {
		activeGTEParam = "0"
	}
	activeGTE, _ := strconv.ParseInt(activeGTEParam, 10, 64)

	activeLTParam := u.Query().Get("active_lt")
	if activeLTParam == "" {
		activeLTParam = "0"
	}
	activeLT, _ := strconv.ParseInt(activeLTParam, 10, 64)

	startedGTEParam := u.Query().Get("started_gte")
	if startedGTEParam == "" {
		startedGTEParam = "0"
	}
	startedGTE, _ := strconv.ParseInt(startedGTEParam, 10, 64)

	startedLTParam := u.Query().Get("started_lt")
	if startedLTParam == "" {
		startedLTParam = "0"
	}
	startedLT, _ := strconv.ParseInt(startedLTParam, 10, 64)

	options := app.PlaybookRunFilterOptions{
		TeamID:                  teamID,
		Page:                    page,
		PerPage:                 perPage,
		Sort:                    app.SortField(sort),
		Direction:               app.SortDirection(direction),
		Statuses:                statuses,
		OwnerID:                 ownerID,
		SearchTerm:              searchTerm,
		ParticipantID:           participantID,
		ParticipantOrFollowerID: participantOrFollowerID,
		PlaybookID:              playbookID,
		ActiveGTE:               activeGTE,
		ActiveLT:                activeLT,
		StartedGTE:              startedGTE,
		StartedLT:               startedLT,
	}

	options, err = options.Validate()
	if err != nil {
		return nil, err
	}

	return &options, nil
}
