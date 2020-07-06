package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/subscription"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type SubscriptionHandler struct {
	subscriptionService subscription.Service
	playbookService     playbook.Service
	pluginAPI           *pluginapi.Client
}

func NewSubscriptionHandler(router *mux.Router, subscriptionService subscription.Service, playbookService playbook.Service,
	api *pluginapi.Client) *SubscriptionHandler {
	handler := &SubscriptionHandler{
		subscriptionService: subscriptionService,
		playbookService:     playbookService,
		pluginAPI:           api,
	}

	subscriptionRouter := router.PathPrefix("/eventsubscriptions").Subrouter()
	subscriptionRouter.HandleFunc("", handler.postSubscription).Methods(http.MethodPost)

	return handler
}

func (h *SubscriptionHandler) hasPermissionsToPlaybook(userID string, pbook playbook.Playbook) bool {
	// TODO: Use playbook members when those are ready
	return h.pluginAPI.User.HasPermissionToTeam(userID, pbook.TeamID, model.PERMISSION_VIEW_TEAM)
}

func (h *SubscriptionHandler) hasPermissionsToAddSubscription(requestorID, userID string, pbook playbook.Playbook) bool {
	return requestorID == userID || h.pluginAPI.User.HasPermissionToTeam(requestorID, pbook.TeamID, model.PERMISSION_MANAGE_TEAM)
}

func (h *SubscriptionHandler) postSubscription(w http.ResponseWriter, r *http.Request) {
	var newSubscription subscription.Subscription
	if err := json.NewDecoder(r.Body).Decode(&newSubscription); err != nil {
		HandleError(w, errors.Wrapf(err, "unable to decode subscription"))
		return
	}

	pbook, err := h.playbookService.Get(newSubscription.PlaybookID)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "unable to get playbookk"))
		return
	}

	requestorID := r.Header.Get("Mattermost-User-ID")

	if !h.hasPermissionsToAddSubscription(requestorID, newSubscription.UserID, pbook) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	if !h.hasPermissionsToPlaybook(newSubscription.UserID, pbook) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	newSubscriptionID, err := h.subscriptionService.Create(newSubscription)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "unable to create subscription"))
		return
	}

	newSubscription.ID = newSubscriptionID

	jsonBytes, err := json.Marshal(&newSubscription)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "unable to marshal subscription"))
		return
	}

	w.WriteHeader(http.StatusCreated)
	// TODO: w.Header().Add("Location", "/api/v1/eventsubscriptions/:subsID")
	w.Header().Add("Content-Type", "application/json")
	_, _ = w.Write(jsonBytes)
}
