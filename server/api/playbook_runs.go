// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
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
	propertyService    app.PropertyServiceReader
	permissions        *app.PermissionsService
	licenseChecker     app.LicenseChecker
	pluginAPI          *pluginapi.Client
	poster             bot.Poster
}

// NewPlaybookRunHandler Creates a new Plugin API handler.
func NewPlaybookRunHandler(
	router *mux.Router,
	playbookRunService app.PlaybookRunService,
	playbookService app.PlaybookService,
	propertyService app.PropertyServiceReader,
	permissions *app.PermissionsService,
	licenseChecker app.LicenseChecker,
	api *pluginapi.Client,
	poster bot.Poster,
	configService config.Service,
) *PlaybookRunHandler {
	handler := &PlaybookRunHandler{
		ErrorHandler:       &ErrorHandler{},
		playbookRunService: playbookRunService,
		playbookService:    playbookService,
		propertyService:    propertyService,
		pluginAPI:          api,
		poster:             poster,
		config:             configService,
		permissions:        permissions,
		licenseChecker:     licenseChecker,
	}

	playbookRunsRouter := router.PathPrefix("/runs").Subrouter()
	playbookRunsRouter.HandleFunc("", withContext(handler.getPlaybookRuns)).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("", withContext(handler.createPlaybookRunFromPost)).Methods(http.MethodPost)

	playbookRunsRouter.HandleFunc("/dialog", withContext(handler.createPlaybookRunFromDialog)).Methods(http.MethodPost)
	playbookRunsRouter.HandleFunc("/add-to-timeline-dialog", withContext(handler.addToTimelineDialog)).Methods(http.MethodPost)
	playbookRunsRouter.HandleFunc("/owners", withContext(handler.getOwners)).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/channels", withContext(handler.getChannels)).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/checklist-autocomplete", withContext(handler.getChecklistAutocomplete)).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/checklist-autocomplete-item", withContext(handler.getChecklistAutocompleteItem)).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/runs-autocomplete", withContext(handler.getChannelRunsAutocomplete)).Methods(http.MethodGet)

	playbookRunRouter := playbookRunsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	playbookRunRouter.HandleFunc("", withContext(handler.getPlaybookRun)).Methods(http.MethodGet)
	playbookRunRouter.HandleFunc("/metadata", withContext(handler.getPlaybookRunMetadata)).Methods(http.MethodGet)
	playbookRunRouter.HandleFunc("/status-updates", withContext(handler.getStatusUpdates)).Methods(http.MethodGet)
	playbookRunRouter.HandleFunc("/request-update", withContext(handler.requestUpdate)).Methods(http.MethodPost)
	playbookRunRouter.HandleFunc("/request-join-channel", withContext(handler.requestJoinChannel)).Methods(http.MethodPost)

	playbookRunRouter.HandleFunc("/owner", withContext(handler.changeOwner)).Methods(http.MethodPost)
	playbookRunRouter.HandleFunc("/finish", withContext(handler.finish)).Methods(http.MethodPut)
	playbookRunRouter.HandleFunc("/restore", withContext(handler.restore)).Methods(http.MethodPut)
	playbookRunRouter.HandleFunc("/finish-dialog", withContext(handler.finishDialog)).Methods(http.MethodPost)
	playbookRunRouter.HandleFunc("/update-status-dialog", withContext(handler.updateStatusDialog)).Methods(http.MethodPost)

	playbookRunRouterAuthorized := playbookRunRouter.PathPrefix("").Subrouter()
	playbookRunRouterAuthorized.Use(handler.checkEditPermissions)
	playbookRunRouterAuthorized.HandleFunc("", withContext(handler.updatePlaybookRun)).Methods(http.MethodPatch)
	playbookRunRouterAuthorized.HandleFunc("/status", withContext(handler.status)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/reminder/button-update", withContext(handler.reminderButtonUpdate)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/reminder", withContext(handler.reminderReset)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/no-retrospective-button", withContext(handler.noRetrospectiveButton)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/timeline/{eventID:[A-Za-z0-9]+}", withContext(handler.removeTimelineEvent)).Methods(http.MethodDelete)
	playbookRunRouterAuthorized.HandleFunc("/status-update-enabled", withContext(handler.toggleStatusUpdates)).Methods(http.MethodPut)

	channelRouter := playbookRunsRouter.PathPrefix("/channel/{channel_id:[A-Za-z0-9]+}").Subrouter()
	channelRouter.HandleFunc("", withContext(handler.getPlaybookRunByChannel)).Methods(http.MethodGet)
	channelRouter.HandleFunc("/runs", withContext(handler.getPlaybookRunsForChannelByUser)).Methods(http.MethodGet)

	checklistsRouter := playbookRunRouterAuthorized.PathPrefix("/checklists").Subrouter()
	checklistsRouter.HandleFunc("", withContext(handler.addChecklist)).Methods(http.MethodPost)
	checklistsRouter.HandleFunc("/move", withContext(handler.moveChecklist)).Methods(http.MethodPost)
	checklistsRouter.HandleFunc("/move-item", withContext(handler.moveChecklistItem)).Methods(http.MethodPost)

	checklistRouter := checklistsRouter.PathPrefix("/{checklist:[0-9]+}").Subrouter()
	checklistRouter.HandleFunc("", withContext(handler.removeChecklist)).Methods(http.MethodDelete)
	checklistRouter.HandleFunc("/add", withContext(handler.addChecklistItem)).Methods(http.MethodPost)
	checklistRouter.HandleFunc("/rename", withContext(handler.renameChecklist)).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/add-dialog", withContext(handler.addChecklistItemDialog)).Methods(http.MethodPost)
	checklistRouter.HandleFunc("/skip", withContext(handler.checklistSkip)).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/restore", withContext(handler.checklistRestore)).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/duplicate", withContext(handler.duplicateChecklist)).Methods(http.MethodPost)

	checklistItem := checklistRouter.PathPrefix("/item/{item:[0-9]+}").Subrouter()
	checklistItem.HandleFunc("", withContext(handler.itemDelete)).Methods(http.MethodDelete)
	checklistItem.HandleFunc("", withContext(handler.itemEdit)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/skip", withContext(handler.itemSkip)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/restore", withContext(handler.itemRestore)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/state", withContext(handler.itemSetState)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/assignee", withContext(handler.itemSetAssignee)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/command", withContext(handler.itemSetCommand)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/run", withContext(handler.itemRun)).Methods(http.MethodPost)
	checklistItem.HandleFunc("/duplicate", withContext(handler.itemDuplicate)).Methods(http.MethodPost)
	checklistItem.HandleFunc("/duedate", withContext(handler.itemSetDueDate)).Methods(http.MethodPut)

	retrospectiveRouter := playbookRunRouterAuthorized.PathPrefix("/retrospective").Subrouter()
	retrospectiveRouter.HandleFunc("", withContext(handler.updateRetrospective)).Methods(http.MethodPost)
	retrospectiveRouter.HandleFunc("/publish", withContext(handler.publishRetrospective)).Methods(http.MethodPost)

	followersRouter := playbookRunRouter.PathPrefix("/followers").Subrouter()
	followersRouter.HandleFunc("", withContext(handler.follow)).Methods(http.MethodPut)
	followersRouter.HandleFunc("", withContext(handler.unfollow)).Methods(http.MethodDelete)
	followersRouter.HandleFunc("", withContext(handler.getFollowers)).Methods(http.MethodGet)

	propertyFieldsRouter := playbookRunRouter.PathPrefix("/property_fields").Subrouter()
	propertyFieldsRouter.HandleFunc("", withContext(handler.getRunPropertyFields)).Methods(http.MethodGet)
	propertyFieldsRouter.HandleFunc("/{fieldID:[A-Za-z0-9]+}/value", withContext(handler.setRunPropertyValue)).Methods(http.MethodPut)

	propertyValuesRouter := playbookRunRouter.PathPrefix("/property_values").Subrouter()
	propertyValuesRouter.HandleFunc("", withContext(handler.getRunPropertyValues)).Methods(http.MethodGet)

	return handler
}

func (h *PlaybookRunHandler) checkEditPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := getLogger(r)
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		playbookRun, err := h.playbookRunService.GetPlaybookRun(vars["id"])
		if err != nil {
			h.HandleError(w, logger, err)
			return
		}

		if !h.PermissionsCheck(w, logger, h.permissions.RunManageProperties(userID, playbookRun.ID)) {
			return
		}

		next.ServeHTTP(w, r)
	})
}

// createPlaybookRunFromPost handles the POST /runs endpoint
func (h *PlaybookRunHandler) createPlaybookRunFromPost(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var playbookRunCreateOptions client.PlaybookRunCreateOptions
	if err := json.NewDecoder(r.Body).Decode(&playbookRunCreateOptions); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode playbook run create options", err)
		return
	}

	if playbookRunCreateOptions.Name != "" {
		trimmedName, err := app.ValidateRunNameUpdate(playbookRunCreateOptions.Name)
		if err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid run name", err)
			return
		}
		playbookRunCreateOptions.Name = trimmedName
	}
	if playbookRunCreateOptions.Summary != "" {
		trimmedSummary, err := app.ValidateRunSummaryUpdate(playbookRunCreateOptions.Summary)
		if err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid run summary", err)
			return
		}
		playbookRunCreateOptions.Summary = trimmedSummary
	}

	if playbookRunCreateOptions.PlaybookID != "" && !model.IsValidId(playbookRunCreateOptions.PlaybookID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid playbook ID", errors.New("invalid playbook ID"))
		return
	}
	if playbookRunCreateOptions.TeamID != "" && !model.IsValidId(playbookRunCreateOptions.TeamID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid team ID", errors.New("invalid team ID"))
		return
	}
	if playbookRunCreateOptions.ChannelID != "" && !model.IsValidId(playbookRunCreateOptions.ChannelID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid channel ID", errors.New("invalid channel ID"))
		return
	}
	if playbookRunCreateOptions.OwnerUserID != "" && !model.IsValidId(playbookRunCreateOptions.OwnerUserID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid owner user ID", errors.New("invalid owner user ID"))
		return
	}
	if playbookRunCreateOptions.PostID != "" && !model.IsValidId(playbookRunCreateOptions.PostID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid post ID", errors.New("invalid post ID"))
		return
	}

	// Set the run type based on whether a playbook ID is provided
	runType := app.RunTypeChannelChecklist
	if playbookRunCreateOptions.PlaybookID != "" {
		runType = app.RunTypePlaybook
	}

	playbookRun, err := h.createPlaybookRun(
		app.PlaybookRun{
			OwnerUserID: playbookRunCreateOptions.OwnerUserID,
			TeamID:      playbookRunCreateOptions.TeamID,
			ChannelID:   playbookRunCreateOptions.ChannelID,
			Name:        playbookRunCreateOptions.Name,
			Summary:     playbookRunCreateOptions.Summary,
			PostID:      playbookRunCreateOptions.PostID,
			PlaybookID:  playbookRunCreateOptions.PlaybookID,
			Type:        runType,
		},
		userID,
		playbookRunCreateOptions.CreatePublicRun,
		app.RunSourcePost,
		playbookRunCreateOptions.PropertyValues,
	)
	if errors.Is(err, app.ErrNoPermissions) {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "unable to create playbook run", err)
		return
	}
	if errors.Is(err, app.ErrNotFound) {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "unable to create playbook run", err)
		return
	}
	if errors.Is(err, app.ErrPlaybookArchived) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to create playbook run", err)
		return
	}
	if errors.Is(err, app.ErrLicensedFeature) {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "unable to create playbook run", err)
		return
	}
	if errors.Is(err, app.ErrMalformedPlaybookRun) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to create playbook run", err)
		return
	}
	if errors.Is(err, app.ErrDuplicateEntry) {
		h.HandleErrorWithCode(w, c.logger, http.StatusConflict, "unable to create playbook run", err)
		return
	}
	if err != nil {
		h.HandleError(w, c.logger, errors.Wrapf(err, "unable to create playbook run"))
		return
	}

	h.poster.PublishWebsocketEventToChannel(app.PlaybookRunCreatedWSEvent, map[string]interface{}{"playbook_run": playbookRun}, playbookRun.ChannelID)

	w.Header().Add("Location", fmt.Sprintf("/api/v0/runs/%s", playbookRun.ID))
	ReturnJSON(w, &playbookRun, http.StatusCreated)
}

func (h *PlaybookRunHandler) updatePlaybookRun(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")
	fieldsToUpdate := map[string]interface{}{}

	oldPlaybookRun, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// NOTE: RunManageProperties is already enforced by the checkEditPermissions middleware
	// on playbookRunRouterAuthorized; no need to check again here.

	var updates client.PlaybookRunUpdateOptions
	if err = json.NewDecoder(r.Body).Decode(&updates); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	// Prevent updates on finished runs
	if err := app.ValidateRunUpdateOnFinished(oldPlaybookRun.CurrentStatus, updates.Name != nil, updates.Summary != nil); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "cannot update a finished run", err)
		return
	}

	// If name is being updated, validate and apply the change
	if updates.Name != nil {
		trimmed, err := app.ValidateRunNameUpdate(*updates.Name)
		if err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid run name", err)
			return
		}
		fieldsToUpdate["Name"] = trimmed
	}

	// If summary is being updated, validate and apply the change
	if updates.Summary != nil {
		trimmed, err := app.ValidateRunSummaryUpdate(*updates.Summary)
		if err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid run summary", err)
			return
		}
		fieldsToUpdate["Description"] = trimmed
		fieldsToUpdate["SummaryModifiedAt"] = model.GetMillis()
	}

	addToSetmap(fieldsToUpdate, "CreateChannelMemberOnNewParticipant", updates.CreateChannelMemberOnNewParticipant)
	addToSetmap(fieldsToUpdate, "RemoveChannelMemberOnRemovedParticipant", updates.RemoveChannelMemberOnRemovedParticipant)
	addToSetmap(fieldsToUpdate, "StatusUpdateBroadcastChannelsEnabled", updates.StatusUpdateBroadcastChannelsEnabled)
	addToSetmap(fieldsToUpdate, "StatusUpdateBroadcastWebhooksEnabled", updates.StatusUpdateBroadcastWebhooksEnabled)

	if updates.ChannelID != nil {
		channel, err := h.pluginAPI.Channel.Get(*updates.ChannelID)
		if err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to get channel", err)
			return
		}

		if channel.TeamId != oldPlaybookRun.TeamID {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "channel not in given team", app.ErrMalformedPlaybookRun)
			return
		}

		permission := model.PermissionManagePublicChannelProperties
		permissionMessage := "You are not able to manage public channel properties"
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelProperties
			permissionMessage = "You are not able to manage private channel properties"
		} else if channel.IsGroupOrDirect() {
			permission = model.PermissionReadChannel
			permissionMessage = "You do not have access to this channel"
		}

		if !h.pluginAPI.User.HasPermissionToChannel(userID, channel.Id, permission) {
			h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, permissionMessage, app.ErrNoPermissions)
			return
		}
		fieldsToUpdate["ChannelID"] = *updates.ChannelID
	}

	if updates.BroadcastChannelIDs != nil {
		if err := h.permissions.NoAddedBroadcastChannelsWithoutPermission(userID, *updates.BroadcastChannelIDs, oldPlaybookRun.BroadcastChannelIDs); err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "you don't have permission to add one or more of the broadcast channels", err)
			return
		}
		addConcatToSetmap(fieldsToUpdate, "ConcatenatedBroadcastChannelIDs", updates.BroadcastChannelIDs)
	}

	if updates.WebhookOnStatusUpdateURLs != nil {
		if err := app.ValidateWebhookURLs(*updates.WebhookOnStatusUpdateURLs); err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid webhook URL", err)
			return
		}
		addConcatToSetmap(fieldsToUpdate, "ConcatenatedWebhookOnStatusUpdateURLs", updates.WebhookOnStatusUpdateURLs)
	}

	// Update using GraphqlUpdate
	if err := h.playbookRunService.GraphqlUpdate(playbookRunID, fieldsToUpdate); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Retrieve the updated playbook run
	updatedPlaybookRun, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, updatedPlaybookRun, http.StatusOK)
}

// createPlaybookRunFromDialog handles the interactive dialog submission when a user presses confirm on
// the create playbook run dialog.
func (h *PlaybookRunHandler) createPlaybookRunFromDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var request *model.SubmitDialogRequest
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		c.logger.WithError(err).WithField("user_id", userID).Error("createPlaybookRunFromDialog: failed to decode SubmitDialogRequest")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Failed to decode the dialog request.",
		}, http.StatusOK)
		return
	}

	if userID != request.UserId {
		c.logger.WithField("user_id", userID).Error("createPlaybookRunFromDialog: interactive dialog's userID must be the same as the requester's userID")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "User ID mismatch in the dialog request.",
		}, http.StatusOK)
		return
	}

	var state app.DialogState
	err = json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		c.logger.WithError(err).WithField("user_id", userID).Error("createPlaybookRunFromDialog: failed to unmarshal dialog state")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Failed to process the dialog state.",
		}, http.StatusOK)
		return
	}

	var playbookID, name string
	if rawPlaybookID, ok := request.Submission[app.DialogFieldPlaybookIDKey].(string); ok {
		playbookID = rawPlaybookID
	}
	if rawName, ok := request.Submission[app.DialogFieldNameKey].(string); ok {
		name = strings.TrimSpace(rawName)
	}

	if name != "" {
		trimmed, err := app.ValidateRunNameUpdate(name)
		if err != nil {
			ReturnJSON(w, &model.SubmitDialogResponse{
				Errors: map[string]string{
					app.DialogFieldNameKey: err.Error(),
				},
			}, http.StatusOK)
			return
		}
		name = trimmed
	}

	channelID := ""
	runType := app.RunTypeChannelChecklist

	// if a playbook ID exists, link the run to the channel and set the right type
	if playbookID != "" {
		playbook, err := h.playbookService.Get(playbookID)
		if err != nil {
			c.logger.WithError(err).WithField("user_id", userID).Error("createPlaybookRunFromDialog: unable to get playbook")
			ReturnJSON(w, &model.SubmitDialogResponse{
				Error: "Unable to load the selected playbook.",
			}, http.StatusOK)
			return
		}
		channelID = playbook.GetRunChannelID()
		runType = app.RunTypePlaybook

	}

	playbookRun, err := h.createPlaybookRun(
		app.PlaybookRun{
			OwnerUserID: request.UserId,
			TeamID:      request.TeamId,
			ChannelID:   channelID,
			Name:        name,
			PostID:      state.PostID,
			PlaybookID:  playbookID,
			Type:        runType,
		},
		request.UserId,
		nil,
		app.RunSourceDialog,
		nil, // initialPropertyValues: not supported via dialog submission
	)
	if err != nil {
		if errors.Is(err, app.ErrMalformedPlaybookRun) {
			ReturnJSON(w, &model.SubmitDialogResponse{
				Errors: map[string]string{
					app.DialogFieldNameKey: "The run name is invalid. Please use a valid name.",
				},
			}, http.StatusOK)
			return
		}

		if errors.Is(err, app.ErrNoPermissions) {
			ReturnJSON(w, &model.SubmitDialogResponse{
				Error: "You are not authorized to make runs from this playbook.",
			}, http.StatusOK)
			return
		}

		if errors.Is(err, app.ErrPlaybookArchived) {
			ReturnJSON(w, &model.SubmitDialogResponse{
				Error: "This playbook is archived and cannot be used to create runs.",
			}, http.StatusOK)
			return
		}

		var msg string

		if errors.Is(err, app.ErrChannelDisplayNameInvalid) {
			msg = "The name is invalid or too long. Please use a valid name with fewer than 64 characters."
		}

		if msg != "" {
			ReturnJSON(w, &model.SubmitDialogResponse{
				Errors: map[string]string{
					app.DialogFieldNameKey: msg,
				},
			}, http.StatusOK)
			return
		}

		if errors.Is(err, app.ErrNotFound) {
			ReturnJSON(w, &model.SubmitDialogResponse{
				Error: "The playbook was deleted. Please refresh and try again.",
			}, http.StatusOK)
			return
		}

		if errors.Is(err, app.ErrLicensedFeature) {
			ReturnJSON(w, &model.SubmitDialogResponse{
				Error: "This feature is not available with your current license.",
			}, http.StatusOK)
			return
		}

		c.logger.WithError(err).WithField("user_id", userID).Error("createPlaybookRunFromDialog: failed to create run")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "An internal error occurred. Please try again.",
		}, http.StatusOK)
		return
	}

	channel, err := h.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		c.logger.WithError(err).WithField("user_id", userID).Error("createPlaybookRunFromDialog: failed to get new channel")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "An internal error occurred after creating the run. Please check the runs list.",
		}, http.StatusOK)
		return
	}

	// Delay sending the websocket message because the front end may try to change to the newly created
	// channel, and the server may respond with a "channel not found" error. This happens in e2e tests,
	// and possibly in the wild.
	go func() {
		time.Sleep(1 * time.Second) // arbitrary 1 second magic number

		h.poster.PublishWebsocketEventToChannel(app.PlaybookRunCreatedWSEvent, map[string]interface{}{
			"client_id":    state.ClientID,
			"playbook_run": playbookRun,
			"channel_name": channel.Name,
		}, playbookRun.ChannelID)
	}()

	if err := h.postPlaybookRunCreatedMessage(playbookRun, request.ChannelId); err != nil {
		c.logger.WithError(err).WithField("user_id", userID).Warn("createPlaybookRunFromDialog: failed to post created message")
		// Don't fail the dialog over a notification-post error; the run was already created.
	}

	w.Header().Add("Location", fmt.Sprintf("/api/v0/runs/%s", playbookRun.ID))
	w.WriteHeader(http.StatusCreated)
}

// addToTimelineDialog handles the interactive dialog submission when a user clicks the
// corresponding post action.
func (h *PlaybookRunHandler) addToTimelineDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	if !h.licenseChecker.TimelineAllowed() {
		c.logger.Warn("addToTimelineDialog: timeline feature is not covered by current server license")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Timeline feature is not available with the current license.",
		}, http.StatusOK)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")

	var request *model.SubmitDialogRequest
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		c.logger.WithError(err).WithField("user_id", userID).Error("addToTimelineDialog: failed to decode SubmitDialogRequest")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Failed to decode the dialog request.",
		}, http.StatusOK)
		return
	}

	if userID != request.UserId {
		c.logger.WithField("user_id", userID).Error("addToTimelineDialog: interactive dialog's userID must be the same as the requester's userID")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "User ID mismatch in the dialog request.",
		}, http.StatusOK)
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
		c.logger.WithError(incErr).WithField("user_id", userID).Error("addToTimelineDialog: failed to get playbook run")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "An internal error occurred. Please try again.",
		}, http.StatusOK)
		return
	}

	if err := h.permissions.RunManageProperties(userID, playbookRun.ID); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			c.logger.WithError(err).WithField("user_id", userID).Warn("addToTimelineDialog: permission denied")
			ReturnJSON(w, &model.SubmitDialogResponse{
				Error: "You do not have permission to add to the timeline.",
			}, http.StatusOK)
		} else {
			c.logger.WithError(err).WithField("user_id", userID).Error("addToTimelineDialog: error checking permission")
			ReturnJSON(w, &model.SubmitDialogResponse{
				Error: "An internal error occurred. Please try again.",
			}, http.StatusOK)
		}
		return
	}

	var state app.DialogStateAddToTimeline
	err = json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		c.logger.WithError(err).WithField("user_id", userID).Error("addToTimelineDialog: failed to unmarshal dialog state")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Failed to process the dialog state.",
		}, http.StatusOK)
		return
	}

	post, err := h.pluginAPI.Post.GetPost(state.PostID)
	if err != nil {
		c.logger.WithError(err).WithField("user_id", userID).Error("addToTimelineDialog: couldn't get post")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Could not find the specified post.",
		}, http.StatusOK)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.ChannelView(userID, post.ChannelId)) {
		return
	}

	if err = h.playbookRunService.AddPostToTimeline(playbookRun, userID, post, summary); err != nil {
		c.logger.WithError(err).WithField("user_id", userID).Error("addToTimelineDialog: failed to add post to timeline")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Failed to add the post to the timeline. Please try again.",
		}, http.StatusOK)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) createPlaybookRun(playbookRun app.PlaybookRun, userID string, createPublicRun *bool, source string, initialPropertyValues map[string]json.RawMessage) (*app.PlaybookRun, error) {
	if len(initialPropertyValues) > app.MaxPropertiesPerPlaybook {
		return nil, errors.Wrapf(app.ErrMalformedPlaybookRun, "too many initial property values (%d), maximum is %d", len(initialPropertyValues), app.MaxPropertiesPerPlaybook)
	}
	// Coarse first-pass guard: reject obviously oversized raw JSON payloads early.
	// Use 4x the rune limit to account for multi-byte UTF-8 characters.
	// The authoritative rune-based validation happens downstream in sanitizeAndValidatePropertyValue.
	for key, val := range initialPropertyValues {
		if !model.IsValidId(key) {
			return nil, errors.Wrapf(app.ErrMalformedPlaybookRun, "property value key %q is not a valid field ID", key)
		}
		if len(val) > 4*app.MaxPropertyValueLength {
			return nil, errors.Wrapf(app.ErrMalformedPlaybookRun, "property value for %q exceeds maximum length", key)
		}
	}

	// Validate initial data
	if playbookRun.ID != "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook run already has an id")
	}

	if playbookRun.CreateAt != 0 {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook run channel already has created at date")
	}

	if playbookRun.TeamID == "" && playbookRun.ChannelID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "must provide team or channel to create playbook run")
	}

	if strings.TrimSpace(playbookRun.Name) == "" && playbookRun.ChannelID == "" && playbookRun.PlaybookID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing name of playbook run")
	}

	// Retrieve channel if needed and validate it
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

	// Copy data from playbook if needed
	public := true
	if createPublicRun != nil {
		public = *createPublicRun
	}

	var playbook *app.Playbook
	// For runs off of a playbook, verify playbook as well as user having run_create
	// for this playbook (via playbook membership).
	if playbookRun.PlaybookID != "" {
		var pb app.Playbook
		pb, err = h.playbookService.Get(playbookRun.PlaybookID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook")
		}
		playbook = &pb

		if playbook.DeleteAt != 0 {
			return nil, errors.Wrap(app.ErrPlaybookArchived, "playbook is archived, cannot create a new run using an archived playbook")
		}

		if err = h.permissions.RunCreate(userID, *playbook, playbookRun.TeamID); err != nil {
			return nil, err
		}

		if source == "dialog" && playbook.ChannelMode == app.PlaybookRunLinkExistingChannel && playbookRun.ChannelID == "" {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook is configured to be linked to existing channel but no channel is configured. Run can not be created from dialog")
		}

		if createPublicRun == nil {
			public = pb.CreatePublicPlaybookRun
		}

		// Second name guard: reject empty names for non-template playbooks
		if strings.TrimSpace(playbookRun.Name) == "" && playbookRun.ChannelID == "" && pb.ChannelNameTemplate == "" {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing name of playbook run")
		}

		playbookRun.SetChecklistFromPlaybook(*playbook)
		playbookRun.SetConfigurationFromPlaybook(*playbook, source)
	} else {
		// For checklists, verify a channel ID and verify user has permission to post in the channel below.
		if channel == nil {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "channel ID is required for checklists")
		}
	}

	// Check the permissions on the channel: the user must be able to create it or,
	// if one's already provided, they need to be able to manage it.
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
		} else if channel.IsGroupOrDirect() {
			permission = model.PermissionReadChannel
			permissionMessage = "You do not have access to this channel"
		}

		if !h.pluginAPI.User.HasPermissionToChannel(userID, channel.Id, permission) {
			return nil, errors.Wrap(app.ErrNoPermissions, permissionMessage)
		}
	}

	// For channelChecklists specifically, verify user has permission to post in the channel
	if playbookRun.Type == app.RunTypeChannelChecklist && playbookRun.ChannelID != "" {
		if !h.pluginAPI.User.HasPermissionToChannel(userID, playbookRun.ChannelID, model.PermissionCreatePost) {
			return nil, errors.Wrap(app.ErrNoPermissions, "You do not have permission to create a checklist in this channel. You must be a member of the channel with posting permissions.")
		}
	}

	// Check the permissions on the provided post: the user must have access to the post's channel
	if playbookRun.PostID != "" {
		var post *model.Post
		post, err = h.pluginAPI.Post.GetPost(playbookRun.PostID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook run original post")
		}
		if !h.pluginAPI.User.HasPermissionToChannel(userID, post.ChannelId, model.PermissionReadChannel) {
			return nil, errors.Wrap(app.ErrNoPermissions, "user does not have access to the channel containing the playbook run's original post")
		}
	}

	// Set ReporterUserID early so BuildSystemTokens can resolve the {CREATOR} template token
	// during ResolveRunCreationParams. CreatePlaybookRun will set it again (same value).
	playbookRun.ReporterUserID = userID
	// Pre-set OwnerUserID so the {OWNER} template token resolves during ResolveRunCreationParams.
	// Priority: explicit caller value > DefaultOwnerID > creator (userID).
	// Team membership is validated inside ResolveRunCreationParams; if the owner is not a team
	// member, OwnerUserID is cleared and re-validated before creation proceeds.
	if playbookRun.OwnerUserID == "" {
		if playbookRun.DefaultOwnerID != "" {
			playbookRun.OwnerUserID = playbookRun.DefaultOwnerID
		} else {
			playbookRun.OwnerUserID = userID
		}
	}
	if playbookRun.OwnerUserID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing owner user id of playbook run")
	}

	// Resolve template placeholders and allocate sequential run numbers.
	// Creation rules evaluated inside ResolveRunCreationParams may inject a new ChannelID;
	// re-check channel access afterwards if it changed.
	channelIDBeforeResolve := playbookRun.ChannelID
	var resolvedChannelName string
	if playbook != nil {
		resolvedChannelName, err = h.playbookRunService.ResolveRunCreationParams(&playbookRun, playbook, initialPropertyValues, source)
		if err != nil {
			return nil, errors.Wrap(err, "failed to resolve run creation params")
		}
	}

	// Re-validate channel access if a creation rule injected a new channel.
	if playbookRun.ChannelID != "" && playbookRun.ChannelID != channelIDBeforeResolve {
		injectedChannel, chErr := h.pluginAPI.Channel.Get(playbookRun.ChannelID)
		if chErr != nil {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "creation rule specified an invalid channel")
		}
		injectedPerm := model.PermissionManagePublicChannelProperties
		injectedMsg := "You do not have permission to manage this channel"
		if injectedChannel.Type == model.ChannelTypePrivate {
			injectedPerm = model.PermissionManagePrivateChannelProperties
		} else if injectedChannel.IsGroupOrDirect() {
			injectedPerm = model.PermissionReadChannel
			injectedMsg = "You do not have access to this channel"
		}
		if !h.pluginAPI.User.HasPermissionToChannel(userID, injectedChannel.Id, injectedPerm) {
			return nil, errors.Wrap(app.ErrNoPermissions, injectedMsg)
		}
		// Prevent cross-team channel injection: the injected channel must belong to the run's team.
		if injectedChannel.TeamId != "" && injectedChannel.TeamId != playbookRun.TeamID {
			return nil, errors.Wrap(app.ErrNoPermissions, "creation rule: channel does not belong to the run's team")
		}
	}

	playbookRunReturned, err := h.playbookRunService.CreatePlaybookRun(&playbookRun, playbook, userID, public, source, resolvedChannelName, initialPropertyValues)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create playbook run")
	}

	// force database retrieval to ensure all data is processed correctly (i.e participantIds)
	return h.playbookRunService.GetPlaybookRun(playbookRunReturned.ID)

}

func (h *PlaybookRunHandler) getRequesterInfo(userID string) (app.RequesterInfo, error) {
	return app.GetRequesterInfo(userID, h.pluginAPI)
}

// getPlaybookRuns handles the GET /runs endpoint.
func (h *PlaybookRunHandler) getPlaybookRuns(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	filterOptions, err := parsePlaybookRunsFilterOptions(r.URL, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	// Add channel permission check if channel_id filter is used
	if filterOptions.ChannelID != "" {
		if !h.PermissionsCheck(w, c.logger, h.permissions.ChannelView(userID, filterOptions.ChannelID)) {
			return
		}
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	results, err := h.playbookRunService.GetPlaybookRuns(requesterInfo, *filterOptions)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, results, http.StatusOK)
}

// getPlaybookRun handles the /runs/{id} endpoint.
func (h *PlaybookRunHandler) getPlaybookRun(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	playbookRunToGet, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, playbookRunToGet, http.StatusOK)
}

// getPlaybookRunMetadata handles the /runs/{id}/metadata endpoint.
func (h *PlaybookRunHandler) getPlaybookRunMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	// Get the playbook run to access its channel ID
	playbookRun, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Check if user has permission to view the channel
	hasChannelAccess := h.pluginAPI.User.HasPermissionToChannel(userID, playbookRun.ChannelID, model.PermissionReadChannel)
	// Get metadata with potentially filtered information
	playbookRunMetadata, err := h.playbookRunService.GetPlaybookRunMetadata(playbookRunID, hasChannelAccess)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, playbookRunMetadata, http.StatusOK)
}

// getPlaybookRunByChannel handles the /runs/channel/{channel_id} endpoint.
// Notice that it returns both playbook runs as well as channel checklists
func (h *PlaybookRunHandler) getPlaybookRunByChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.ChannelView(userID, channelID)) {
		return
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// get playbook runs for the specific channel and user
	playbookRunsResult, err := h.playbookRunService.GetPlaybookRuns(
		requesterInfo,
		app.PlaybookRunFilterOptions{
			ChannelID: channelID,
			Page:      0,
			PerPage:   2,
		},
	)

	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
	playbookRuns := playbookRunsResult.Items
	if len(playbookRuns) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found",
			errors.Errorf("playbook run for channel id %s not found", channelID))
		return
	}

	if len(playbookRuns) > 1 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "multiple runs in the channel", nil)
		return
	}

	playbookRun := playbookRuns[0]
	ReturnJSON(w, &playbookRun, http.StatusOK)
}

// getOwners handles the /runs/owners api endpoint.
func (h *PlaybookRunHandler) getOwners(c *Context, w http.ResponseWriter, r *http.Request) {
	teamID := r.URL.Query().Get("team_id")

	userID := r.Header.Get("Mattermost-User-ID")
	options := app.PlaybookRunFilterOptions{
		TeamID: teamID,
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	owners, err := h.playbookRunService.GetOwners(requesterInfo, options)
	if err != nil {
		h.HandleError(w, c.logger, errors.Wrapf(err, "failed to get owners"))
		return
	}

	if owners == nil {
		owners = []app.OwnerInfo{}
	}

	ReturnJSON(w, owners, http.StatusOK)
}

func (h *PlaybookRunHandler) getChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	filterOptions, err := parsePlaybookRunsFilterOptions(r.URL, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	playbookRuns, err := h.playbookRunService.GetPlaybookRuns(requesterInfo, *filterOptions)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	channelIDs := make([]string, 0, len(playbookRuns.Items))
	for _, playbookRun := range playbookRuns.Items {
		channelIDs = append(channelIDs, playbookRun.ChannelID)
	}

	ReturnJSON(w, channelIDs, http.StatusOK)
}

// changeOwner handles the /runs/{id}/owner api endpoint.
func (h *PlaybookRunHandler) changeOwner(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	if !model.IsValidId(vars["id"]) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid run ID", errors.New("invalid run ID"))
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		OwnerID string `json:"owner_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "could not decode request body", err)
		return
	}

	if err := app.ValidateOwnerID(params.OwnerID); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid owner ID", err)
		return
	}

	if err := h.permissions.RunChangeOwner(userID, vars["id"]); err != nil {
		// Return 403 for both ErrNotFound and ErrNoPermissions to avoid leaking run existence.
		// Other errors (e.g., DB failures) are returned as 500.
		if errors.Is(err, app.ErrNotFound) || errors.Is(err, app.ErrNoPermissions) {
			h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "You don't have permission to change the owner of this run.", err)
		} else {
			h.HandleError(w, c.logger, err)
		}
		return
	}

	if err := h.playbookRunService.ChangeOwner(vars["id"], userID, params.OwnerID); err != nil {
		if errors.Is(err, app.ErrNotFound) {
			h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Run not found.", err)
			return
		}
		h.HandleError(w, c.logger, err)
		return
	}

	c.logger.WithField("run_id", vars["id"]).WithField("user_id", userID).WithField("new_owner_id", params.OwnerID).Info("playbook run owner changed")

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

// updateStatusD handles the POST /runs/{id}/status endpoint, user has edit permissions
func (h *PlaybookRunHandler) status(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var options app.StatusUpdateOptions
	if err := json.NewDecoder(r.Body).Decode(&options); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode body into StatusUpdateOptions", err)
		return
	}

	if publicMsg, internalErr := h.updateStatus(playbookRunID, userID, options, c.logger); internalErr != nil {
		if errors.Is(internalErr, app.ErrNoPermissions) {
			h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, publicMsg, internalErr)
		} else if errors.Is(internalErr, app.ErrNotFound) {
			h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, publicMsg, internalErr)
		} else if errors.Is(internalErr, app.ErrMalformedPlaybookRun) || errors.Is(internalErr, app.ErrPlaybookRunNotActive) {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, publicMsg, internalErr)
		} else {
			h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, publicMsg, internalErr)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

// updateStatus returns a publicMessage and an internal error
func (h *PlaybookRunHandler) updateStatus(playbookRunID, userID string, options app.StatusUpdateOptions, logger logrus.FieldLogger) (string, error) {
	if options.FinishRun {
		// RunFinish already includes the base participant check plus OwnerOnlyFinish.
		if err := h.permissions.RunFinish(userID, playbookRunID); err != nil {
			return "You don't have permission to finish this run.", err
		}
	} else {
		// Require participant access for status updates.
		if err := h.permissions.RunManageProperties(userID, playbookRunID); err != nil {
			return "Not authorized", err
		}
	}

	options.Message = strings.TrimSpace(options.Message)
	if options.Message == "" {
		return "message must not be empty", errors.New("message field empty")
	}

	if options.Reminder <= 0 && !options.FinishRun {
		return "the reminder must be set and not 0", errors.New("reminder was 0")
	}

	// options.Reminder arrives as integer seconds from the dialog; convert to Duration once.
	reminderDuration := options.Reminder * time.Second
	if options.Reminder < 0 || options.FinishRun {
		options.Reminder = 0
	} else {
		options.Reminder = reminderDuration
	}

	if err := h.playbookRunService.UpdateStatus(playbookRunID, userID, options); err != nil {
		if errors.Is(err, app.ErrNotFound) {
			return "The run was not found.", err
		}
		return "An internal error has occurred. Check app server logs for details.", err
	}

	// Finish after the status update so the status post is created while the run
	// is still InProgress, avoiding duplicate channel announcements.
	if options.FinishRun {
		if err := h.playbookRunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
			// Restore the reminder since FinishPlaybookRun failed and the run stays InProgress
			if reminderDuration > 0 {
				if restoreErr := h.playbookRunService.SetNewReminder(playbookRunID, reminderDuration); restoreErr != nil {
					logger.WithError(restoreErr).WithField("playbook_run_id", playbookRunID).Warn("failed to restore reminder after FinishPlaybookRun failure")
				}
			}
			return "An internal error has occurred. Check app server logs for details.", err
		}
	}

	return "", nil
}

// updateStatusD handles the POST /runs/{id}/finish endpoint, user has edit permissions
func (h *PlaybookRunHandler) finish(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	if !model.IsValidId(playbookRunID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid run ID", errors.New("invalid run ID"))
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.permissions.RunFinish(userID, playbookRunID); err != nil {
		// Return 403 for both ErrNotFound and ErrNoPermissions to avoid leaking run existence.
		// Other errors (e.g., DB failures) are returned as 500.
		if errors.Is(err, app.ErrNotFound) || errors.Is(err, app.ErrNoPermissions) {
			h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "You don't have permission to finish this run.", err)
		} else {
			h.HandleError(w, c.logger, err)
		}
		return
	}

	if err := h.playbookRunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
		if errors.Is(err, app.ErrNotFound) {
			h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Run not found.", err)
			return
		}
		h.HandleError(w, c.logger, err)
		return
	}

	c.logger.WithField("run_id", playbookRunID).WithField("user_id", userID).Info("playbook run finished")

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

// getStatusUpdates handles the GET /runs/{id}/status endpoint
//
// Our goal is to deliver status updates to any user (when playbook is public) or
// any playbook member (when playbook is private). To do that we need to bypass the
// permissions system and avoid checking channel membership.
//
// This approach will be deprecated as a step towards channel-playbook decoupling.
func (h *PlaybookRunHandler) getStatusUpdates(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	playbookRun, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	posts := make([]*app.StatusPostComplete, 0)
	for _, p := range playbookRun.StatusPosts {
		post, err := h.pluginAPI.Post.GetPost(p.ID)
		if err != nil {
			c.logger.WithError(err).WithField("post_id", p.ID).Error("statusUpdates: can not retrieve post")
			continue
		}

		// Given the fact that we are bypassing some permissions,
		// an additional check is added to limit the risk
		if post.Type == "custom_run_update" {
			posts = append(posts, app.NewStatusPostComplete(post))
		}
	}

	// sort by creation date, so that the first element is the newest post
	sort.Slice(posts, func(i, j int) bool {
		return posts[i].CreateAt > posts[j].CreateAt
	})

	ReturnJSON(w, posts, http.StatusOK)
}

// restore "un-finishes" a playbook run.
func (h *PlaybookRunHandler) restore(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	if !model.IsValidId(playbookRunID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid run ID", errors.New("invalid run ID"))
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.permissions.RunRestore(userID, playbookRunID); err != nil {
		// Return 403 for both ErrNotFound and ErrNoPermissions to avoid leaking run existence.
		// Other errors (e.g., DB failures) are returned as 500.
		if errors.Is(err, app.ErrNotFound) || errors.Is(err, app.ErrNoPermissions) {
			h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "You don't have permission to restore this run.", err)
		} else {
			h.HandleError(w, c.logger, err)
		}
		return
	}

	if err := h.playbookRunService.RestorePlaybookRun(playbookRunID, userID); err != nil {
		if errors.Is(err, app.ErrNotFound) {
			h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Run not found.", err)
			return
		}
		h.HandleError(w, c.logger, err)
		return
	}

	c.logger.WithField("run_id", playbookRunID).WithField("user_id", userID).Info("playbook run restored")

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

// requestUpdate posts a status update request message in the run's channel
func (h *PlaybookRunHandler) requestUpdate(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	if err := h.playbookRunService.RequestUpdate(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
}

// requestJoinChannel posts a channel-join request message in the run's channel
func (h *PlaybookRunHandler) requestJoinChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	// user must be a participant to be able to request to join the channel
	if !h.PermissionsCheck(w, c.logger, h.permissions.RunManageProperties(userID, playbookRunID)) {
		return
	}

	if err := h.playbookRunService.RequestJoinChannel(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
}

// finishDialog handles the POST /runs/{id}/finish-dialog endpoint, called when a
// user submits the Finish Run dialog.
func (h *PlaybookRunHandler) finishDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !model.IsValidId(playbookRunID) {
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Invalid run ID.",
		}, http.StatusOK)
		return
	}

	if err := h.permissions.RunFinish(userID, playbookRunID); err != nil {
		// Always return the same message regardless of underlying cause (not-found vs
		// no-permission) to avoid leaking whether the run ID exists.
		c.logger.WithError(err).WithField("user_id", userID).Warn("finishDialog: permission denied or run not found")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "You don't have permission to finish this run.",
		}, http.StatusOK)
		return
	}

	if err := h.playbookRunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
		c.logger.WithError(err).WithField("user_id", userID).Error("finishDialog: failed to finish playbook run")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Failed to finish the run. Please try again.",
		}, http.StatusOK)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) toggleStatusUpdates(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var payload struct {
		StatusEnabled bool `json:"status_enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if err := h.playbookRunService.ToggleStatusUpdates(playbookRunID, userID, payload.StatusEnabled); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{"success": true}, http.StatusOK)

}

// updateStatusDialog handles the POST /runs/{id}/update-status-dialog endpoint, called when a
// user submits the Update Status dialog.
func (h *PlaybookRunHandler) updateStatusDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !model.IsValidId(playbookRunID) {
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Invalid run ID.",
		}, http.StatusOK)
		return
	}

	var request *model.SubmitDialogRequest
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		c.logger.WithError(err).WithField("user_id", userID).Error("updateStatusDialog: failed to decode SubmitDialogRequest")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "Failed to decode the request. Please try again.",
		}, http.StatusOK)
		return
	}

	if userID != request.UserId {
		c.logger.WithField("user_id", userID).Error("updateStatusDialog: interactive dialog's userID must be the same as the requester's userID")
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: "User ID mismatch in the dialog request.",
		}, http.StatusOK)
		return
	}

	var options app.StatusUpdateOptions
	if message, ok := request.Submission[app.DialogFieldMessageKey]; ok {
		messageStr, valid := message.(string)
		if !valid {
			ReturnJSON(w, &model.SubmitDialogResponse{
				Error: "Message must be a string.",
			}, http.StatusOK)
			return
		}
		options.Message = messageStr
	}

	if reminderI, ok := request.Submission[app.DialogFieldReminderInSecondsKey]; ok {
		reminderStr, valid := reminderI.(string)
		if !valid {
			ReturnJSON(w, &model.SubmitDialogResponse{
				Error: "Reminder must be a string.",
			}, http.StatusOK)
			return
		}
		var reminder int
		reminder, err = strconv.Atoi(reminderStr)
		if err != nil {
			ReturnJSON(w, &model.SubmitDialogResponse{
				Error: "Invalid reminder value.",
			}, http.StatusOK)
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

	if publicMsg, internalErr := h.updateStatus(playbookRunID, userID, options, c.logger); internalErr != nil {
		if errors.Is(internalErr, app.ErrNoPermissions) {
			c.logger.WithError(internalErr).WithField("user_id", userID).Warn("updateStatusDialog: permission denied")
		} else {
			c.logger.WithError(internalErr).WithField("user_id", userID).Error("updateStatusDialog: failed to update status")
		}
		ReturnJSON(w, &model.SubmitDialogResponse{
			Error: publicMsg,
		}, http.StatusOK)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// reminderButtonUpdate handles the POST /runs/{id}/reminder/button-update endpoint, called when a
// user clicks on the reminder interactive button
func (h *PlaybookRunHandler) reminderButtonUpdate(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	var requestData *model.PostActionIntegrationRequest
	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil || requestData == nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "missing request data", nil)
		return
	}

	// NOTE: RunManageProperties is already enforced by the checkEditPermissions middleware.
	// Verify that the body-supplied UserId matches the authenticated session user to prevent
	// confused-deputy attacks (the middleware validated the session user, not requestData.UserId).
	userID := r.Header.Get("Mattermost-User-ID")
	if requestData.UserId != userID {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "interactive request user does not match authenticated user", nil)
		return
	}

	if err = h.playbookRunService.OpenUpdateStatusDialog(playbookRunID, requestData.UserId, requestData.TriggerId); err != nil {
		h.HandleError(w, c.logger, errors.Wrap(err, "reminderButtonUpdate failed to open update status dialog"))
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// reminderReset handles the POST /runs/{id}/reminder endpoint, called when a
// user clicks on the reminder custom_update_status time selector
func (h *PlaybookRunHandler) reminderReset(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	var payload struct {
		NewReminderSeconds int `json:"new_reminder_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if payload.NewReminderSeconds <= 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "new_reminder_seconds must be > 0", errors.New("new_reminder_seconds was <= 0"))
		return
	}

	// NOTE: RunManageProperties is already enforced by the checkEditPermissions middleware
	// on playbookRunRouterAuthorized; no need to re-fetch the run or check again here.

	if err := h.playbookRunService.ResetReminder(playbookRunID, time.Duration(payload.NewReminderSeconds)*time.Second); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "error removing reminder post",
			errors.Wrapf(err, "reminderReset: error setting new reminder for playbookRunID %s", playbookRunID))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) noRetrospectiveButton(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	// NOTE: RunManageProperties is already enforced by the checkEditPermissions middleware
	// on playbookRunRouterAuthorized; no need to re-fetch the run or check again here.

	if err := h.playbookRunService.CancelRetrospective(playbookRunID, userID); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "unable to cancel retrospective", err)
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// removeTimelineEvent handles the DELETE /runs/{id}/timeline/{eventID} endpoint.
// User has been authenticated to edit the playbook run.
func (h *PlaybookRunHandler) removeTimelineEvent(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")
	eventID := vars["eventID"]

	if err := h.playbookRunService.RemoveTimelineEvent(id, userID, eventID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) getChecklistAutocompleteItem(c *Context, w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	// Require channel_id to prevent unauthorized access to runs from other channels
	if channelID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "channel_id is required", nil)
		return
	}

	// Verify user has access to the channel
	// Return 404 instead of 403 to avoid leaking information about private channel existence
	if !h.pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel) {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found", nil)
		return
	}

	playbookRuns, err := h.playbookRunService.GetPlaybookRunsForChannelByUser(channelID, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError,
			fmt.Sprintf("unable to retrieve runs for channel id %s", channelID), err)
		return
	}
	if len(playbookRuns) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found",
			errors.Errorf("playbook run for channel id %s not found", channelID))
		return
	}

	data, err := h.playbookRunService.GetChecklistItemAutocomplete(playbookRuns)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *PlaybookRunHandler) getChecklistAutocomplete(c *Context, w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	// Require channel_id to prevent unauthorized access to runs from other channels
	if channelID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "channel_id is required", nil)
		return
	}

	// Verify user has access to the channel
	// Return 404 instead of 403 to avoid leaking information about private channel existence
	if !h.pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel) {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found", nil)
		return
	}

	playbookRuns, err := h.playbookRunService.GetPlaybookRunsForChannelByUser(channelID, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError,
			fmt.Sprintf("unable to retrieve runs for channel id %s", channelID), err)
		return
	}
	if len(playbookRuns) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found",
			errors.Errorf("playbook run for channel id %s not found", channelID))
		return
	}

	data, err := h.playbookRunService.GetChecklistAutocomplete(playbookRuns)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *PlaybookRunHandler) getChannelRunsAutocomplete(c *Context, w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	// Require channel_id to prevent unauthorized access to runs from other channels
	if channelID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "channel_id is required", nil)
		return
	}

	// Verify user has access to the channel
	// Return 404 instead of 403 to avoid leaking information about private channel existence
	if !h.pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel) {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found", nil)
		return
	}

	playbookRuns, err := h.playbookRunService.GetPlaybookRunsForChannelByUser(channelID, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError,
			fmt.Sprintf("unable to retrieve runs for channel id %s", channelID), err)
		return
	}
	if len(playbookRuns) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found",
			errors.Errorf("playbook run for channel id %s not found", channelID))
		return
	}

	data, err := h.playbookRunService.GetRunsAutocomplete(playbookRuns)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *PlaybookRunHandler) getPlaybookRunsForChannelByUser(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.ChannelView(userID, channelID)) {
		return
	}

	playbookRuns, err := h.playbookRunService.GetPlaybookRunsForChannelByUser(channelID, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError,
			fmt.Sprintf("unable to retrieve runs for channel id %s", channelID), err)
		return
	}

	ReturnJSON(w, playbookRuns, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetState(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		NewState string `json:"new_state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if !app.IsValidChecklistItemState(params.NewState) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter new state", nil)
		return
	}

	if err := h.playbookRunService.ModifyCheckedState(id, userID, params.NewState, checklistNum, itemNum); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "not permitted to modify this task", err)
			return
		}
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetAssignee(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		AssigneeID              string `json:"assignee_id"`
		AssigneeGroupID         string `json:"assignee_group_id"`
		AssigneeType            string `json:"assignee_type"`
		AssigneePropertyFieldID string `json:"assignee_property_field_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	// Validate mutual exclusivity: at most one assignee designator may be set.
	exclusiveCount := 0
	if params.AssigneePropertyFieldID != "" && !model.IsValidId(params.AssigneePropertyFieldID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid assignee_property_field_id", errors.New("invalid assignee_property_field_id"))
		return
	}
	if params.AssigneeGroupID != "" && !model.IsValidId(params.AssigneeGroupID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid assignee_group_id", errors.New("invalid assignee_group_id"))
		return
	}
	if params.AssigneeID != "" && !model.IsValidId(params.AssigneeID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid assignee_id", errors.New("invalid assignee_id"))
		return
	}

	if params.AssigneePropertyFieldID != "" {
		exclusiveCount++
	}
	if params.AssigneeGroupID != "" {
		exclusiveCount++
	}
	if params.AssigneeType == app.AssigneeTypeOwner || params.AssigneeType == app.AssigneeTypeCreator {
		exclusiveCount++
	}
	if params.AssigneeType != "" && params.AssigneeType != app.AssigneeTypeOwner && params.AssigneeType != app.AssigneeTypeCreator {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid assignee_type", errors.New("assignee_type must be owner, creator, or blank"))
		return
	}
	if params.AssigneeID != "" && (params.AssigneeGroupID != "" || params.AssigneePropertyFieldID != "" || params.AssigneeType == app.AssigneeTypeOwner || params.AssigneeType == app.AssigneeTypeCreator) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "assignee_id cannot be combined with assignee_group_id, assignee_property_field_id, or role assignee_type", errors.New("ambiguous assignee parameters"))
		return
	}
	if exclusiveCount > 1 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "exactly one of assignee_property_field_id, assignee_group_id, or assignee_type (owner/creator) may be set", errors.New("ambiguous assignee parameters"))
		return
	}

	if params.AssigneePropertyFieldID != "" {
		if err := h.playbookRunService.SetPropertyUserAssignee(userID, id, checklistNum, itemNum, params.AssigneePropertyFieldID); err != nil {
			h.HandleError(w, c.logger, err)
			return
		}
		ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
		return
	} else if params.AssigneeGroupID != "" {
		if err := h.playbookRunService.SetGroupAssignee(id, userID, params.AssigneeGroupID, checklistNum, itemNum); err != nil {
			h.HandleError(w, c.logger, err)
			return
		}
	} else if params.AssigneeType == app.AssigneeTypeOwner || params.AssigneeType == app.AssigneeTypeCreator {
		if err := h.playbookRunService.SetRoleAssignee(id, userID, params.AssigneeType, checklistNum, itemNum); err != nil {
			h.HandleError(w, c.logger, err)
			return
		}
	} else {
		if err := h.playbookRunService.SetAssignee(id, userID, params.AssigneeID, checklistNum, itemNum); err != nil {
			h.HandleError(w, c.logger, err)
			return
		}
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetDueDate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !h.licenseChecker.ChecklistItemDueDateAllowed() {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "checklist item due date feature is not covered by current server license", nil)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		DueDate int64 `json:"due_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if err := h.playbookRunService.SetDueDate(id, userID, params.DueDate, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if err := h.playbookRunService.SetCommandToChecklistItem(id, userID, checklistNum, itemNum, params.Command); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemRun(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	// Check the body is empty
	if _, err := r.Body.Read(make([]byte, 1)); err != io.EOF {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "request body must be empty", nil)
		return
	}

	triggerID, err := h.playbookRunService.RunChecklistItemSlashCommand(playbookRunID, userID, checklistNum, itemNum)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{"trigger_id": triggerID}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemDuplicate(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	// Check the body is empty
	if _, err := r.Body.Read(make([]byte, 1)); err != io.EOF {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "request body must be empty", nil)
		return
	}

	if err := h.playbookRunService.DuplicateChecklistItem(playbookRunID, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) addChecklist(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var checklist app.Checklist
	if err := json.NewDecoder(r.Body).Decode(&checklist); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to decode Checklist", err)
		return
	}

	checklist.Title = strings.TrimSpace(checklist.Title)
	if checklist.Title == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter: checklist title",
			errors.New("checklist title must not be blank"))
		return
	}

	if err := h.playbookRunService.AddChecklist(id, userID, checklist); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) removeChecklist(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RemoveChecklist(id, userID, checklistNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) duplicateChecklist(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.DuplicateChecklist(playbookRunID, userID, checklistNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) addChecklistItem(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var checklistItem app.ChecklistItem
	if err := json.NewDecoder(r.Body).Decode(&checklistItem); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to decode ChecklistItem", err)
		return
	}

	checklistItem.Title = strings.TrimSpace(checklistItem.Title)
	if checklistItem.Title == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter: checklist item title",
			errors.New("checklist item title must not be blank"))
		return
	}

	if err := h.playbookRunService.AddChecklistItem(id, userID, checklistNum, checklistItem); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// addChecklistItemDialog handles the interactive dialog submission when a user clicks add new task
func (h *PlaybookRunHandler) addChecklistItemDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}

	var request *model.SubmitDialogRequest
	err = json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to decode SubmitDialogRequest", err)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
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
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter: checklist item title",
			errors.New("checklist item title must not be blank"))
		return
	}

	if err := h.playbookRunService.AddChecklistItem(playbookRunID, userID, checklistNum, checklistItem); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)

}

func (h *PlaybookRunHandler) itemDelete(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RemoveChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) checklistSkip(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.SkipChecklist(id, userID, checklistNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) checklistRestore(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RestoreChecklist(id, userID, checklistNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) itemSkip(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.SkipChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) itemRestore(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RestoreChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) itemEdit(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Title       string `json:"title"`
		Command     string `json:"command"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal edit params state", err)
		return
	}

	if err := h.playbookRunService.EditChecklistItem(id, userID, checklistNum, itemNum, params.Title, params.Command, params.Description); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) renameChecklist(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var modificationParams struct {
		NewTitle string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&modificationParams); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal new title", err)
		return
	}

	if modificationParams.NewTitle == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter: checklist title",
			errors.New("checklist title must not be blank"))
		return
	}

	if err := h.playbookRunService.RenameChecklist(id, userID, checklistNum, modificationParams.NewTitle); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) moveChecklist(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		SourceChecklistIdx int `json:"source_checklist_idx"`
		DestChecklistIdx   int `json:"dest_checklist_idx"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal edit params", err)
		return
	}

	if err := h.playbookRunService.MoveChecklist(id, userID, params.SourceChecklistIdx, params.DestChecklistIdx); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) moveChecklistItem(c *Context, w http.ResponseWriter, r *http.Request) {
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
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal edit params", err)
		return
	}

	if err := h.playbookRunService.MoveChecklistItem(id, userID, params.SourceChecklistIdx, params.SourceItemIdx, params.DestChecklistIdx, params.DestItemIdx); err != nil {
		h.HandleError(w, c.logger, err)
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

func (h *PlaybookRunHandler) updateRetrospective(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var retroUpdate app.RetrospectiveUpdate

	if err := json.NewDecoder(r.Body).Decode(&retroUpdate); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	if err := h.playbookRunService.UpdateRetrospective(playbookRunID, userID, retroUpdate); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "unable to update retrospective", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) publishRetrospective(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var retroUpdate app.RetrospectiveUpdate

	if err := json.NewDecoder(r.Body).Decode(&retroUpdate); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	if err := h.playbookRunService.PublishRetrospective(playbookRunID, userID, retroUpdate); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "unable to publish retrospective", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) follow(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	if err := h.playbookRunService.Follow(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) unfollow(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	if err := h.playbookRunService.Unfollow(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) getFollowers(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	var followers []string
	var err error
	if followers, err = h.playbookRunService.GetFollowers(playbookRunID); err != nil {
		h.HandleError(w, c.logger, err)
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

	// Get channel_id parameter from URL query
	channelID := u.Query().Get("channel_id")

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

	// Parse types= query string parameters as an array.
	types := u.Query()["types"]

	// Parse since parameter for timestamp-based activity filtering
	sinceParam := u.Query().Get("since")
	var activitySince int64
	if sinceParam != "" {
		activitySince, err = strconv.ParseInt(sinceParam, 10, 64)
		if err != nil {
			return nil, errors.Wrapf(err, "bad parameter 'since'")
		}
	}

	// Parse omit_ended param - default to false for backward compatibility
	omitEndedParam := u.Query().Get("omit_ended")
	omitEnded := omitEndedParam == "true" // Default to false if not specified or invalid

	propertyFieldID := u.Query().Get("property_field_id")
	if propertyFieldID != "" && !model.IsValidId(propertyFieldID) {
		return nil, errors.New("bad parameter 'property_field_id': must be 26 characters or blank")
	}
	propertyValueFilter := u.Query().Get("property_value_filter")
	if propertyValueFilter != "" && !model.IsValidId(propertyValueFilter) {
		return nil, errors.New("bad parameter 'property_value_filter': must be 26 characters or blank")
	}

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
		ChannelID:               channelID,
		ActiveGTE:               activeGTE,
		ActiveLT:                activeLT,
		StartedGTE:              startedGTE,
		StartedLT:               startedLT,
		Types:                   types,
		ActivitySince:           activitySince,
		OmitEnded:               omitEnded,
		PropertyFieldID:         propertyFieldID,
		PropertyValueFilter:     propertyValueFilter,
	}

	options, err = options.Validate()
	if err != nil {
		return nil, err
	}

	return &options, nil
}

func (h *PlaybookRunHandler) requirePlaybookAttributesLicense(w http.ResponseWriter, logger logrus.FieldLogger) bool {
	return checkPlaybookAttributesLicense(h.licenseChecker, w, logger)
}

func (h *PlaybookRunHandler) getRunPropertyFields(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.requirePlaybookAttributesLicense(w, c.logger) {
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	// Parse optional updated_since query parameter
	var updatedSince int64 = 0
	if updatedSinceStr := r.URL.Query().Get("updated_since"); updatedSinceStr != "" {
		parsed, err := strconv.ParseInt(updatedSinceStr, 10, 64)
		if err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid updated_since parameter", err)
			return
		}
		updatedSince = parsed
	}

	propertyFields, err := h.propertyService.GetRunPropertyFieldsSince(playbookRunID, updatedSince)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, propertyFields, http.StatusOK)
}

func (h *PlaybookRunHandler) getRunPropertyValues(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.requirePlaybookAttributesLicense(w, c.logger) {
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	// Parse optional updated_since query parameter
	var updatedSince int64 = 0
	if updatedSinceStr := r.URL.Query().Get("updated_since"); updatedSinceStr != "" {
		parsed, err := strconv.ParseInt(updatedSinceStr, 10, 64)
		if err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid updated_since parameter", err)
			return
		}
		updatedSince = parsed
	}

	propertyValues, err := h.propertyService.GetRunPropertyValuesSince(playbookRunID, updatedSince)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, propertyValues, http.StatusOK)
}

func (h *PlaybookRunHandler) setRunPropertyValue(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	fieldID := vars["fieldID"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !model.IsValidId(playbookRunID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid run ID", nil)
		return
	}

	if !model.IsValidId(fieldID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid field ID", nil)
		return
	}

	if !h.requirePlaybookAttributesLicense(w, c.logger) {
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunManageProperties(userID, playbookRunID)) {
		return
	}

	var valueRequest struct {
		Value json.RawMessage `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&valueRequest); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	// Coarse byte-size guard: the authoritative rune-count check is in the service layer.
	// Use 4x multiplier to account for multi-byte UTF-8 and JSON encoding overhead.
	if len(valueRequest.Value) > 4*app.MaxPropertyValueLength {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest,
			fmt.Sprintf("property value exceeds maximum size of %d characters", app.MaxPropertyValueLength), nil)
		return
	}

	propertyValue, err := h.playbookRunService.SetRunPropertyValue(userID, playbookRunID, fieldID, valueRequest.Value)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, propertyValue, http.StatusOK)
}
