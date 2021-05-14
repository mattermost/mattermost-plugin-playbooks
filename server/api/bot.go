package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-server/v5/model"
)

type BotHandler struct {
	*ErrorHandler
	pluginAPI *pluginapi.Client
	poster    bot.Poster
	config    config.Service
}

func NewBotHandler(router *mux.Router, api *pluginapi.Client, poster bot.Poster, logger bot.Logger, config config.Service) *BotHandler {
	handler := &BotHandler{
		ErrorHandler: &ErrorHandler{log: logger},
		pluginAPI:    api,
		poster:       poster,
		config:       config,
	}

	botRouter := router.PathPrefix("/bot").Subrouter()

	notifyAdminsRouter := botRouter.PathPrefix("/notify-admins").Subrouter()
	notifyAdminsRouter.HandleFunc("", handler.notifyAdmins).Methods(http.MethodPost)
	notifyAdminsRouter.HandleFunc("/button-start-trial", handler.startTrial).Methods(http.MethodPost)

	return handler
}

type messagePayload struct {
	MessageType string `json:"message_type"`
}

func (h *BotHandler) notifyAdmins(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var payload messagePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode message", err)
		return
	}

	if err := h.poster.NotifyAdmins(payload.MessageType, userID); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *BotHandler) startTrial(w http.ResponseWriter, r *http.Request) {
	requestData := model.PostActionIntegrationRequestFromJson(r.Body)
	if requestData == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "missing request data", nil)
		return
	}

	users, ok := requestData.Context["users"].(float64)
	if !ok {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "malformed context: users is not a number", nil)
		return
	}

	termsAccepted, ok := requestData.Context["termsAccepted"].(bool)
	if !ok {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "malformed context: termsAccepted is not a boolean", nil)
		return
	}

	receiveEmailsAccepted, ok := requestData.Context["receiveEmailsAccepted"].(bool)
	if !ok {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "malformed context: receiveEmailsAccepted is not a boolean", nil)
		return
	}

	originalPost, err := h.pluginAPI.Post.GetPost(requestData.PostId)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	// Modify the button text while the license is downloading
	originalAttachments := originalPost.Attachments()
outer:
	for _, attachment := range originalAttachments {
		for _, action := range attachment.Actions {
			if action.Id == "message" {
				action.Name = "Requesting trial..."
				break outer
			}
		}
	}
	model.ParseSlackAttachment(originalPost, originalAttachments)
	_ = h.pluginAPI.Post.UpdatePost(originalPost)

	post := &model.Post{
		Id: requestData.PostId,
	}

	if err := h.pluginAPI.System.RequestTrialLicense(requestData.UserId, int(users), termsAccepted, receiveEmailsAccepted); err != nil {
		post.Message = "Trial license could not be retrieved. Visit [https://mattermost.com/trial/](https://mattermost.com/trial/) to request a license."

		if postErr := h.pluginAPI.Post.UpdatePost(post); postErr != nil {
			h.pluginAPI.Log.Warn("unable to edit the admin notification post", "post ID", post.Id)
		}

		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to request the trial license", err)
		return
	}

	post.Message = "Thank you!"
	attachments := []*model.SlackAttachment{
		{
			Title: "You’re currently on a free trial of our Enterprise Edition E20 license.",
			Text:  "Your free trial will expire in **30 days**. Visit our Customer Portal to purchase a license to continue using Enterprise Edition E10 and E20 features after your trial ends.\n[Purchase a license](https://customers.mattermost.com/signup)\n[Contact sales](https://mattermost.com/contact-us/)",
		},
	}
	model.ParseSlackAttachment(post, attachments)

	if err := h.pluginAPI.Post.UpdatePost(post); err != nil {
		h.pluginAPI.Log.Warn("unable to edit the admin notification post", "post ID", post.Id)
	}

	ReturnJSON(w, post, http.StatusOK)
}
