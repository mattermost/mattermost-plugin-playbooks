package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"

	"github.com/gorilla/mux"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
)

type ActionsHandler struct {
	*ErrorHandler
	channelActionsService app.ChannelActionService
	pluginAPI             *pluginapi.Client
	permissions           *app.PermissionsService
}

func NewActionsHandler(router *mux.Router, log bot.Logger, channelActionsService app.ChannelActionService, pluginAPI *pluginapi.Client, permissions *app.PermissionsService) *ActionsHandler {
	handler := &ActionsHandler{
		ErrorHandler:          &ErrorHandler{log: log},
		channelActionsService: channelActionsService,
		pluginAPI:             pluginAPI,
		permissions:           permissions,
	}

	actionsRouter := router.PathPrefix("/actions").Subrouter()

	channelsActionsRouter := actionsRouter.PathPrefix("/channels").Subrouter()
	channelActionsRouter := channelsActionsRouter.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()
	channelActionsRouter.HandleFunc("", handler.createChannelAction).Methods(http.MethodPost)
	channelActionsRouter.HandleFunc("", handler.getChannelActions).Methods(http.MethodGet)
	channelActionsRouter.HandleFunc("/check-and-send-message-on-join", handler.checkAndSendMessageOnJoin).Methods(http.MethodGet)

	channelActionRouter := channelActionsRouter.PathPrefix("/{action_id:[A-Za-z0-9]+}").Subrouter()
	channelActionRouter.HandleFunc("", handler.updateChannelAction).Methods(http.MethodPut)

	return handler
}

func (a *ActionsHandler) createChannelAction(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	vars := mux.Vars(r)
	channelID := vars["channel_id"]

	if !a.PermissionsCheck(w, a.permissions.ChannelActionCreate(userID, channelID)) {
		return
	}

	var channelAction app.GenericChannelAction
	if err := json.NewDecoder(r.Body).Decode(&channelAction); err != nil {
		a.HandleErrorWithCode(w, http.StatusBadRequest, "unable to parse action", err)
		return
	}

	// Ensure that the channel ID in both the URL and the body of the request are the same;
	// otherwise the permission check done above no longer makes sense
	if channelAction.ChannelID != channelID {
		a.HandleErrorWithCode(w, http.StatusBadRequest, "channel ID in request body must match channel ID in URL", nil)
		return
	}

	// Validate the action type and payload
	if err := a.channelActionsService.Validate(channelAction); err != nil {
		a.HandleErrorWithCode(w, http.StatusBadRequest, "invalid action", err)
		return
	}

	id, err := a.channelActionsService.Create(channelAction)
	if err != nil {
		a.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to create action", err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: id,
	}
	w.Header().Add("Location", makeAPIURL(a.pluginAPI, "actions/channel/%s/%s", channelAction.ChannelID, id))

	ReturnJSON(w, &result, http.StatusCreated)
}

func (a *ActionsHandler) getChannelActions(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	vars := mux.Vars(r)
	channelID := vars["channel_id"]

	if !a.PermissionsCheck(w, a.permissions.ChannelActionView(userID, channelID)) {
		return
	}

	params := r.URL.Query()
	triggerType := params.Get("trigger_type")

	actions, err := a.channelActionsService.GetChannelActions(channelID, triggerType)
	if err != nil {
		a.HandleErrorWithCode(w, http.StatusInternalServerError, fmt.Sprintf("unable to retrieve actions for channel %s", channelID), err)
		return
	}

	ReturnJSON(w, &actions, http.StatusOK)
}

// checkAndSendMessageOnJoin handles the GET /actions/channels/{channel_id}/check_and_send_message_on_join endpoint.
func (a *ActionsHandler) checkAndSendMessageOnJoin(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !a.PermissionsCheck(w, a.permissions.ChannelActionView(userID, channelID)) {
		return
	}

	hasViewed := a.channelActionsService.CheckAndSendMessageOnJoin(userID, channelID)
	ReturnJSON(w, map[string]interface{}{"viewed": hasViewed}, http.StatusOK)
}

func (a *ActionsHandler) updateChannelAction(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	vars := mux.Vars(r)
	channelID := vars["channel_id"]

	if !a.PermissionsCheck(w, a.permissions.ChannelActionUpdate(userID, channelID)) {
		return
	}

	var newChannelAction app.GenericChannelAction
	if err := json.NewDecoder(r.Body).Decode(&newChannelAction); err != nil {
		a.HandleErrorWithCode(w, http.StatusBadRequest, "unable to parse action", err)
		return
	}

	// Ensure that the channel ID in both the URL and the body of the request are the same;
	// otherwise the permission check done above no longer makes sense
	if newChannelAction.ChannelID != channelID {
		a.HandleErrorWithCode(w, http.StatusBadRequest, "channel ID in request body must match channel ID in URL", nil)
		return
	}

	// Validate the new action type and payload
	if err := a.channelActionsService.Validate(newChannelAction); err != nil {
		a.HandleErrorWithCode(w, http.StatusBadRequest, "invalid action", err)
		return
	}

	err := a.channelActionsService.Update(newChannelAction)
	if err != nil {
		a.HandleErrorWithCode(w, http.StatusInternalServerError, fmt.Sprintf("unable to update action with ID %q", newChannelAction.ID), err)
		return
	}

	w.WriteHeader(http.StatusOK)
}
