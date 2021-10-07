package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/pkg/errors"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-server/v6/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type BotHandler struct {
	*ErrorHandler
	pluginAPI          *pluginapi.Client
	poster             bot.Poster
	config             config.Service
	playbookRunService app.PlaybookRunService
	userInfoStore      app.UserInfoStore
}

func NewBotHandler(router *mux.Router, api *pluginapi.Client, poster bot.Poster, logger bot.Logger,
	config config.Service, playbookRunService app.PlaybookRunService, userInfoStore app.UserInfoStore) *BotHandler {
	handler := &BotHandler{
		ErrorHandler:       &ErrorHandler{log: logger},
		pluginAPI:          api,
		poster:             poster,
		config:             config,
		playbookRunService: playbookRunService,
		userInfoStore:      userInfoStore,
	}

	botRouter := router.PathPrefix("/bot").Subrouter()

	notifyAdminsRouter := botRouter.PathPrefix("/notify-admins").Subrouter()
	notifyAdminsRouter.HandleFunc("", handler.notifyAdmins).Methods(http.MethodPost)
	notifyAdminsRouter.HandleFunc("/button-start-trial", handler.startTrial).Methods(http.MethodPost)

	botRouter.HandleFunc("/prompt-for-feedback", handler.promptForFeedback).Methods(http.MethodPost)
	botRouter.HandleFunc("/connect", handler.connect).Methods(http.MethodGet)

	return handler
}

type messagePayload struct {
	MessageType   string `json:"message_type"`
	IsTeamEdition bool   `json:"is_team_edition"`
}

func (h *BotHandler) notifyAdmins(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var payload messagePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode message", err)
		return
	}

	if err := h.poster.NotifyAdmins(payload.MessageType, userID, payload.IsTeamEdition); err != nil {
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
			Title: "You’re currently on a free trial of Mattermost Enterprise.",
			Text:  "Your free trial will expire in **30 days**. Visit our Customer Portal to purchase a license to continue using commercial edition features after your trial ends.\n[Purchase a license](https://customers.mattermost.com/signup)\n[Contact sales](https://mattermost.com/contact-us/)",
		},
	}
	model.ParseSlackAttachment(post, attachments)

	if err := h.pluginAPI.Post.UpdatePost(post); err != nil {
		h.pluginAPI.Log.Warn("unable to edit the admin notification post", "post ID", post.Id)
	}

	ReturnJSON(w, post, http.StatusOK)
}

func (h *BotHandler) promptForFeedback(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.config.SupportsGivingFeedback(); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "giving feedback not supported", err)
		return
	}

	if err := h.poster.PromptForFeedback(userID); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// connect handles the GET /bot/connect endpoint (a notification sent when the client wakes up or reconnects)
func (h *BotHandler) connect(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	info, err := h.userInfoStore.Get(userID)
	if errors.Is(err, app.ErrNotFound) {
		info = app.UserInfo{
			ID: userID,
		}
	} else if err != nil {
		h.HandleError(w, err)
		return
	}

	var timezone *time.Location
	offset, _ := strconv.Atoi(r.Header.Get("X-Timezone-Offset"))
	timezone = time.FixedZone("local", -60*offset)

	// DM message if it's the next day and been more than an hour since the last post
	// Hat tip to Github plugin for the logic.
	now := model.GetMillis()
	nt := time.Unix(now/1000, 0).In(timezone)
	lt := time.Unix(info.LastDailyTodoDMAt/1000, 0).In(timezone)
	if nt.Sub(lt).Hours() >= 1 && (nt.Day() != lt.Day() || nt.Month() != lt.Month() || nt.Year() != lt.Year()) {
		// record that we're sending a DM now (this will prevent us trying over and over on every
		// response if there's a failure later)
		info.LastDailyTodoDMAt = now
		if err = h.userInfoStore.Upsert(info); err != nil {
			h.HandleError(w, err)
			return
		}

		if err = h.playbookRunService.DMTodoDigestToUser(userID, false); err != nil {
			h.HandleError(w, errors.Wrapf(err, "failed to DMTodoDigest to userID '%s'", userID))
			return
		}
	}

	w.WriteHeader(http.StatusOK)
}
