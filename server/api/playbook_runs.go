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
	"github.com/mattermost/mattermost-server/v5/model"
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
	pluginAPI          *pluginapi.Client
	poster             bot.Poster
	log                bot.Logger
}

// NewPlaybookRunHandler Creates a new Plugin API handler.
func NewPlaybookRunHandler(router *mux.Router, playbookRunService app.PlaybookRunService, playbookService app.PlaybookService,
	api *pluginapi.Client, poster bot.Poster, log bot.Logger, configService config.Service) *PlaybookRunHandler {
	handler := &PlaybookRunHandler{
		ErrorHandler:       &ErrorHandler{log: log},
		playbookRunService: playbookRunService,
		playbookService:    playbookService,
		pluginAPI:          api,
		poster:             poster,
		log:                log,
		config:             configService,
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
	playbookRunRouterAuthorized.HandleFunc("/update-status-dialog", handler.updateStatusDialog).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/reminder/button-update", handler.reminderButtonUpdate).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/reminder/button-dismiss", handler.reminderButtonDismiss).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/no-retrospective-button", handler.noRetrospectiveButton).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/timeline/{eventID:[A-Za-z0-9]+}", handler.removeTimelineEvent).Methods(http.MethodDelete)
	playbookRunRouterAuthorized.HandleFunc("/check-and-send-message-on-join/{channel_id:[A-Za-z0-9]+}", handler.checkAndSendMessageOnJoin).Methods(http.MethodGet)
	playbookRunRouterAuthorized.HandleFunc("/update-description", handler.updateDescription).Methods(http.MethodPut)

	channelRouter := playbookRunsRouter.PathPrefix("/channel").Subrouter()
	channelRouter.HandleFunc("/{channel_id:[A-Za-z0-9]+}", handler.getPlaybookRunByChannel).Methods(http.MethodGet)

	checklistsRouter := playbookRunRouterAuthorized.PathPrefix("/checklists").Subrouter()

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

	retrospectiveRouter := playbookRunRouterAuthorized.PathPrefix("/retrospective").Subrouter()
	retrospectiveRouter.HandleFunc("", handler.updateRetrospective).Methods(http.MethodPost)
	retrospectiveRouter.HandleFunc("/publish", handler.publishRetrospective).Methods(http.MethodPost)

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

		if err := app.EditPlaybookRun(userID, playbookRun.ChannelID, h.pluginAPI); err != nil {
			if errors.Is(err, app.ErrNoPermissions) {
				h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err)
				return
			}
			h.HandleError(w, err)
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

	if !app.IsOnEnabledTeam(playbookRunCreateOptions.TeamID, h.config) {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "not enabled on this team", nil)
		return
	}

	playbookRun, err := h.createPlaybookRun(
		app.PlaybookRun{
			OwnerUserID: playbookRunCreateOptions.OwnerUserID,
			TeamID:      playbookRunCreateOptions.TeamID,
			Name:        playbookRunCreateOptions.Name,
			Description: playbookRunCreateOptions.Description,
			PostID:      playbookRunCreateOptions.PostID,
			PlaybookID:  playbookRunCreateOptions.PlaybookID,
		},
		userID,
	)

	if errors.Is(err, app.ErrPermission) {
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

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	if !app.IsOnEnabledTeam(request.TeamId, h.config) {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "not enabled on this team", nil)
		return
	}

	var state app.DialogState
	err := json.Unmarshal([]byte(request.State), &state)
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

		var msg string

		if errors.Is(err, app.ErrChannelDisplayNameInvalid) {
			msg = "The name is invalid or too long. Please use a valid name with fewer than 64 characters."
		} else if errors.Is(err, app.ErrPermission) {
			msg = err.Error()
		}

		if msg != "" {
			resp := &model.SubmitDialogResponse{
				Errors: map[string]string{
					app.DialogFieldNameKey: msg,
				},
			}
			_, _ = w.Write(resp.ToJson())
			return
		}

		h.HandleError(w, err)
		return
	}

	h.poster.PublishWebsocketEventToUser(app.PlaybookRunCreatedWSEvent, map[string]interface{}{
		"client_id":    state.ClientID,
		"playbook_run": playbookRun,
	}, request.UserId)

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
	userID := r.Header.Get("Mattermost-User-ID")

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
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

	if err := app.EditPlaybookRun(userID, playbookRun.ChannelID, h.pluginAPI); err != nil {
		return
	}

	var state app.DialogStateAddToTimeline
	err := json.Unmarshal([]byte(request.State), &state)
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

	if playbookRun.ChannelID != "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook run channel already has an id")
	}

	if playbookRun.CreateAt != 0 {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook run channel already has created at date")
	}

	if playbookRun.TeamID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing team id of playbook run")
	}

	if playbookRun.OwnerUserID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing owner user id of playbook run")
	}

	if playbookRun.Name == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing name of playbook run")
	}

	// Owner should have permission to the team
	if !app.CanViewTeam(playbookRun.OwnerUserID, playbookRun.TeamID, h.pluginAPI) {
		return nil, errors.Wrap(app.ErrPermission, "owner user does not have permissions for the team")
	}

	public := true
	var playbook *app.Playbook
	if playbookRun.PlaybookID != "" {
		pb, err := h.playbookService.Get(playbookRun.PlaybookID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook")
		}

		if len(pb.MemberIDs) != 0 && !sliceContains(pb.MemberIDs, userID) {
			return nil, errors.New("userID is not a member of playbook")
		}

		playbookRun.Checklists = pb.Checklists
		public = pb.CreatePublicPlaybookRun

		playbookRun.BroadcastChannelID = pb.BroadcastChannelID
		playbookRun.Description = pb.Description
		playbookRun.ReminderMessageTemplate = pb.ReminderMessageTemplate
		playbookRun.PreviousReminder = time.Duration(pb.ReminderTimerDefaultSeconds) * time.Second
		playbookRun.CategorizeChannelEnabled = pb.CategorizeChannelEnabled

		playbookRun.InvitedUserIDs = []string{}
		playbookRun.InvitedGroupIDs = []string{}
		if pb.InviteUsersEnabled {
			playbookRun.InvitedUserIDs = pb.InvitedUserIDs
			playbookRun.InvitedGroupIDs = pb.InvitedGroupIDs
		}

		if pb.DefaultOwnerEnabled {
			playbookRun.DefaultOwnerID = pb.DefaultOwnerID
		}

		if pb.AnnouncementChannelEnabled {
			playbookRun.AnnouncementChannelID = pb.AnnouncementChannelID
		}

		if pb.WebhookOnCreationEnabled {
			playbookRun.WebhookOnCreationURL = pb.WebhookOnCreationURL
		}

		if pb.WebhookOnStatusUpdateEnabled {
			playbookRun.WebhookOnStatusUpdateURL = pb.WebhookOnStatusUpdateURL
		}

		if pb.MessageOnJoinEnabled {
			playbookRun.MessageOnJoin = pb.MessageOnJoin
		}

		if pb.ExportChannelOnArchiveEnabled {
			playbookRun.ExportChannelOnArchiveEnabled = pb.ExportChannelOnArchiveEnabled
		}

		if pb.CategorizeChannelEnabled {
			playbookRun.CategoryName = pb.CategoryName
		}

		playbookRun.RetrospectiveReminderIntervalSeconds = pb.RetrospectiveReminderIntervalSeconds
		playbookRun.Retrospective = pb.RetrospectiveTemplate

		playbook = &pb
	}

	permission := model.PERMISSION_CREATE_PRIVATE_CHANNEL
	permissionMessage := "You are not able to create a private channel"
	if public {
		permission = model.PERMISSION_CREATE_PUBLIC_CHANNEL
		permissionMessage = "You are not able to create a public channel"
	}
	if !h.pluginAPI.User.HasPermissionToTeam(userID, playbookRun.TeamID, permission) {
		return nil, errors.Wrap(app.ErrPermission, permissionMessage)
	}

	if playbookRun.PostID != "" {
		post, err := h.pluginAPI.Post.GetPost(playbookRun.PostID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook run original post")
		}
		if !app.MemberOfChannelID(userID, post.ChannelId, h.pluginAPI) {
			return nil, errors.New("user is not a member of the channel containing the playbook run's original post")
		}
	}
	return h.playbookRunService.CreatePlaybookRun(&playbookRun, playbook, userID, public)
}

func (h *PlaybookRunHandler) getRequesterInfo(userID string) (app.RequesterInfo, error) {
	return app.GetRequesterInfo(userID, h.pluginAPI)
}

// getPlaybookRuns handles the GET /runs endpoint.
func (h *PlaybookRunHandler) getPlaybookRuns(w http.ResponseWriter, r *http.Request) {
	filterOptions, err := parsePlaybookRunsFilterOptions(r.URL)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
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

	playbookRunToGet, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err := app.ViewPlaybookRunFromChannelID(userID, playbookRunToGet.ChannelID, h.pluginAPI); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "User doesn't have permissions to playbook run.", nil)
		return
	}

	ReturnJSON(w, playbookRunToGet, http.StatusOK)
}

// getPlaybookRunMetadata handles the /runs/{id}/metadata endpoint.
func (h *PlaybookRunHandler) getPlaybookRunMetadata(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRunToGet, incErr := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if incErr != nil {
		h.HandleError(w, incErr)
		return
	}

	if err := app.ViewPlaybookRunFromChannelID(userID, playbookRunToGet.ChannelID, h.pluginAPI); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized",
			errors.Errorf("userid: %s does not have permissions to view the playbook run details", userID))
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

	if err := app.ViewPlaybookRunFromChannelID(userID, channelID, h.pluginAPI); err != nil {
		h.log.Warnf("User %s does not have permissions to get playbook run for channel %s", userID, channelID)
		h.HandleErrorWithCode(w, http.StatusNotFound, "Not found",
			errors.Errorf("playbook run for channel id %s not found", channelID))
		return
	}

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
	filterOptions, err := parsePlaybookRunsFilterOptions(r.URL)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
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
	if err := app.EditPlaybookRun(params.OwnerID, playbookRun.ChannelID, h.pluginAPI); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized",
				errors.Errorf("userid: %s does not have permissions to playbook run channel; cannot be made owner", params.OwnerID))
			return
		}
		h.HandleError(w, err)
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

	options.Message = strings.TrimSpace(options.Message)
	if options.Message == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "message must not be empty", errors.New("message field empty"))
		return
	}

	options.Reminder = options.Reminder * time.Second

	options.Status = strings.TrimSpace(options.Status)
	if options.Status == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "status must not be empty", errors.New("status field empty"))
		return
	}
	switch options.Status {
	case app.StatusActive:
	case app.StatusArchived:
	case app.StatusReported:
	case app.StatusResolved:
		break
	default:
		h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid status", nil)
		return
	}

	err = h.playbookRunService.UpdateStatus(playbookRunID, userID, options)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
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

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
		return
	}

	var options app.StatusUpdateOptions
	if message, ok := request.Submission[app.DialogFieldMessageKey]; ok {
		options.Message = strings.TrimSpace(message.(string))
	}
	if options.Message == "" {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"errors": {"%s":"This field is required."}}`, app.DialogFieldMessageKey)))
		return
	}

	if reminderI, ok := request.Submission[app.DialogFieldReminderInSecondsKey]; ok {
		if reminder, err2 := strconv.Atoi(reminderI.(string)); err2 == nil {
			options.Reminder = time.Duration(reminder) * time.Second
		}
	}

	if status, ok := request.Submission[app.DialogFieldStatusKey]; ok {
		options.Status = status.(string)
	}

	switch options.Status {
	case app.StatusActive:
	case app.StatusArchived:
	case app.StatusReported:
	case app.StatusResolved:
		break
	default:
		h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid status", nil)
		return
	}

	err = h.playbookRunService.UpdateStatus(playbookRunID, userID, options)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// reminderButtonUpdate handles the POST /runs/{id}/reminder/button-update endpoint, called when a
// user clicks on the reminder interactive button
func (h *PlaybookRunHandler) reminderButtonUpdate(w http.ResponseWriter, r *http.Request) {
	requestData := model.PostActionIntegrationRequestFromJson(r.Body)
	if requestData == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "missing request data", nil)
		return
	}

	playbookRunID, err := h.playbookRunService.GetPlaybookRunIDForChannel(requestData.ChannelId)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error getting playbook run",
			errors.Wrapf(err, "reminderButtonUpdate failed to find playbookRunID for channelID: %s", requestData.ChannelId))
		return
	}

	if err = app.EditPlaybookRun(requestData.UserId, requestData.ChannelId, h.pluginAPI); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			ReturnJSON(w, nil, http.StatusForbidden)
			return
		}
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error getting permissions", err)
		return
	}

	if err = h.playbookRunService.OpenUpdateStatusDialog(playbookRunID, requestData.TriggerId, ""); err != nil {
		h.HandleError(w, errors.New("reminderButtonUpdate failed to open update status dialog"))
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// reminderButtonDismiss handles the POST /runs/{id}/reminder/button-dismiss endpoint, called when a
// user clicks on the reminder interactive button
func (h *PlaybookRunHandler) reminderButtonDismiss(w http.ResponseWriter, r *http.Request) {
	requestData := model.PostActionIntegrationRequestFromJson(r.Body)
	if requestData == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "missing request data", nil)
		return
	}

	playbookRunID, err := h.playbookRunService.GetPlaybookRunIDForChannel(requestData.ChannelId)
	if err != nil {
		h.log.Errorf("reminderButtonDismiss: no playbook run for requestData's channelID: %s", requestData.ChannelId)
		h.HandleErrorWithCode(w, http.StatusBadRequest, "no playbook run for requestData's channelID", err)
		return
	}

	if err = app.EditPlaybookRun(requestData.UserId, requestData.ChannelId, h.pluginAPI); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			ReturnJSON(w, nil, http.StatusForbidden)
			return
		}
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error getting permissions", err)
		return
	}

	if err = h.playbookRunService.RemoveReminderPost(playbookRunID); err != nil {
		h.log.Errorf("reminderButtonDismiss: error removing reminder for channelID: %s; error: %s", requestData.ChannelId, err.Error())
		h.HandleErrorWithCode(w, http.StatusBadRequest, "error removing reminder", err)
		return
	}

	if err = h.playbookRunService.ResetReminderTimer(playbookRunID); err != nil {
		h.log.Errorf("reminderButtonDismiss: error resetting reminder for channelID: %s; error: %s", requestData.ChannelId, err.Error())
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error resetting reminder", err)
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

func (h *PlaybookRunHandler) noRetrospectiveButton(w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRunToCancelRetro, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err = app.EditPlaybookRun(userID, playbookRunToCancelRetro.ChannelID, h.pluginAPI); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			ReturnJSON(w, nil, http.StatusForbidden)
			return
		}
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error getting permissions", err)
		return
	}

	if err := h.playbookRunService.CancelRetrospective(playbookRunID, userID); err != nil {
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

// checkAndSendMessageOnJoin handles the GET /run/{id}/check_and_send_message_on_join/{channel_id} endpoint.
func (h *PlaybookRunHandler) checkAndSendMessageOnJoin(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	hasViewed := h.playbookRunService.CheckAndSendMessageOnJoin(userID, playbookRunID, channelID)
	ReturnJSON(w, map[string]interface{}{"viewed": hasViewed}, http.StatusOK)
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

	if err = app.EditPlaybookRun(userID, playbookRun.ChannelID, h.pluginAPI); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			ReturnJSON(w, nil, http.StatusForbidden)
			return
		}
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error getting permissions", err)
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

	playbookRunID, err := h.playbookRunService.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err = app.ViewPlaybookRunFromChannelID(userID, channelID, h.pluginAPI); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions", err)
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

	playbookRunID, err := h.playbookRunService.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err = app.ViewPlaybookRunFromChannelID(userID, channelID, h.pluginAPI); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions", err)
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

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
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

func (h *PlaybookRunHandler) reorderChecklist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var modificationParams struct {
		ItemNum     int `json:"item_num"`
		NewLocation int `json:"new_location"`
	}
	if err := json.NewDecoder(r.Body).Decode(&modificationParams); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal edit params", err)
		return
	}

	if err := h.playbookRunService.MoveChecklistItem(id, userID, checklistNum, modificationParams.ItemNum, modificationParams.NewLocation); err != nil {
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

	var retroUpdate struct {
		Retrospective string `json:"retrospective"`
	}

	if err := json.NewDecoder(r.Body).Decode(&retroUpdate); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	if err := h.playbookRunService.UpdateRetrospective(playbookRunID, userID, retroUpdate.Retrospective); err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to update retrospective", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) publishRetrospective(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var retroUpdate struct {
		Retrospective string `json:"retrospective"`
	}

	if err := json.NewDecoder(r.Body).Decode(&retroUpdate); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	if err := h.playbookRunService.PublishRetrospective(playbookRunID, retroUpdate.Retrospective, userID); err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to publish retrospective", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// parsePlaybookRunsFilterOptions is only for parsing. Put validation logic in app.validateOptions.
func parsePlaybookRunsFilterOptions(u *url.URL) (*app.PlaybookRunFilterOptions, error) {
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

	statuses := u.Query()["statuses"]

	ownerID := u.Query().Get("owner_user_id")
	searchTerm := u.Query().Get("search_term")

	memberID := u.Query().Get("member_id")

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
		TeamID:     teamID,
		Page:       page,
		PerPage:    perPage,
		Sort:       app.SortField(sort),
		Direction:  app.SortDirection(direction),
		Statuses:   statuses,
		OwnerID:    ownerID,
		SearchTerm: searchTerm,
		MemberID:   memberID,
		PlaybookID: playbookID,
		ActiveGTE:  activeGTE,
		ActiveLT:   activeLT,
		StartedGTE: startedGTE,
		StartedLT:  startedLT,
	}

	options, err = options.Validate()
	if err != nil {
		return nil, err
	}

	return &options, nil
}

func sliceContains(strs []string, target string) bool {
	for _, s := range strs {
		if s == target {
			return true
		}
	}
	return false
}
