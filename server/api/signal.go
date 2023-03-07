package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type SignalHandler struct {
	*ErrorHandler
	api                   *pluginapi.Client
	playbookRunService    app.PlaybookRunService
	playbookService       app.PlaybookService
	keywordsThreadIgnorer app.KeywordsThreadIgnorer
}

func NewSignalHandler(router *mux.Router, api *pluginapi.Client, logger bot.Logger, playbookRunService app.PlaybookRunService, playbookService app.PlaybookService, keywordsThreadIgnorer app.KeywordsThreadIgnorer) *SignalHandler {
	handler := &SignalHandler{
		ErrorHandler:          &ErrorHandler{log: logger},
		api:                   api,
		playbookRunService:    playbookRunService,
		playbookService:       playbookService,
		keywordsThreadIgnorer: keywordsThreadIgnorer,
	}

	signalRouter := router.PathPrefix("/signal").Subrouter()

	keywordsRouter := signalRouter.PathPrefix("/keywords").Subrouter()
	keywordsRouter.HandleFunc("/run-playbook", handler.playbookRun).Methods(http.MethodPost)
	keywordsRouter.HandleFunc("/ignore-thread", handler.ignoreKeywords).Methods(http.MethodPost)

	return handler
}

func (h *SignalHandler) playbookRun(w http.ResponseWriter, r *http.Request) {
	publicErrorMessage := "unable to decode post action integration request"

	var req *model.PostActionIntegrationRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		h.returnError(publicErrorMessage, err, w)
		return
	}
	if req == nil {
		h.returnError(publicErrorMessage, errors.New("nil request"), w)
		return
	}

	id, err := getStringField("selected_option", req.Context, w)
	if err != nil {
		h.returnError(publicErrorMessage, err, w)
		return
	}

	isMobile, err := getBoolField("isMobile", req.Context, w)
	if err != nil {
		h.returnError(publicErrorMessage, err, w)
		return
	}

	pbook, err := h.playbookService.Get(id)
	if err != nil {
		h.returnError("can't get chosen playbook", errors.Wrapf(err, "can't get chosen playbook, id - %s", id), w)
		return
	}

	if err := h.playbookRunService.OpenCreatePlaybookRunDialog(req.TeamId, req.UserId, req.TriggerId, "", "", []app.Playbook{pbook}, isMobile); err != nil {
		h.returnError("can't open dialog", errors.Wrap(err, "can't open a dialog"), w)
		return
	}

	ReturnJSON(w, &model.PostActionIntegrationResponse{}, http.StatusOK)
	if err := h.api.Post.DeletePost(req.PostId); err != nil {
		h.returnError("unable to delete original post", err, w)
		return
	}
}

func (h *SignalHandler) ignoreKeywords(w http.ResponseWriter, r *http.Request) {
	publicErrorMessage := "unable to decode post action integration request"

	var req *model.PostActionIntegrationRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req == nil {
		h.returnError(publicErrorMessage, err, w)
		return
	}

	postID, err := getStringField("postID", req.Context, w)
	if err != nil {
		h.returnError(publicErrorMessage, err, w)
		return
	}
	post, err := h.api.Post.GetPost(postID)
	if err != nil {
		h.returnError(publicErrorMessage, err, w)
		return
	}

	h.keywordsThreadIgnorer.Ignore(postID, post.UserId)
	if post.RootId != "" {
		h.keywordsThreadIgnorer.Ignore(post.RootId, post.UserId)
	}

	ReturnJSON(w, &model.PostActionIntegrationResponse{}, http.StatusOK)
	if err := h.api.Post.DeletePost(req.PostId); err != nil {
		h.returnError("unable to delete original post", err, w)
		return
	}
}

func (h *SignalHandler) returnError(returnMessage string, err error, w http.ResponseWriter) {
	resp := model.PostActionIntegrationResponse{
		EphemeralText: fmt.Sprintf("Error: %s", returnMessage),
	}
	h.log.Errorf(err.Error())
	ReturnJSON(w, &resp, http.StatusOK)
}

func getStringField(field string, context map[string]interface{}, w http.ResponseWriter) (string, error) {
	fieldInt, ok := context[field]
	if !ok {
		return "", errors.Errorf("no %s field in the request context", field)
	}
	fieldValue, ok := fieldInt.(string)
	if !ok {
		return "", errors.Errorf("%s field is not a string", field)
	}
	return fieldValue, nil
}

func getBoolField(field string, context map[string]interface{}, w http.ResponseWriter) (bool, error) {
	fieldInt, ok := context[field]
	if !ok {
		return false, errors.Errorf("no %s field in the request context", field)
	}
	fieldValue, ok := fieldInt.(bool)
	if !ok {
		return false, errors.Errorf("%s field is not a string", field)
	}
	return fieldValue, nil
}
