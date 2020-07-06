package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/subscription"
	"github.com/pkg/errors"
)

type SubscriptionHandler struct {
	subscriptionService subscription.Service
	pluginAPI           *pluginapi.Client
}

func NewSubscriptionHandler(router *mux.Router, subscriptionService subscription.Service, api *pluginapi.Client) *SubscriptionHandler {
	handler := &SubscriptionHandler{
		subscriptionService: subscriptionService,
		pluginAPI:           api,
	}

	subscriptionRouter := router.PathPrefix("/eventsubscriptions").Subrouter()
	subscriptionRouter.HandleFunc("", handler.postSubscription).Methods(http.MethodPost)

	return handler
}

func (h *SubscriptionHandler) postSubscription(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	// TODO: Check real permissions and return proper error
	if userID == "" {
		return
	}

	// TODO: Check what I need from the user to build a subscription
	var payloadSubscription subscription.Subscription
	if err := json.NewDecoder(r.Body).Decode(&payloadSubscription); err != nil {
		HandleError(w, errors.Wrapf(err, "unable to decode subscription"))
		return
	}

	newSubscription, err := h.subscriptionService.Create(payloadSubscription)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "unable to create incident"))
		return
	}

	ReturnJSON(w, &newSubscription)
}
