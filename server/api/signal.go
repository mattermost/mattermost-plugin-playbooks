package api

import (
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type SignalHandler struct {
	*ErrorHandler
	api             *pluginapi.Client
	incidentService incident.Service
	playbookService playbook.Service
	keywordsIgnorer playbook.KeywordsIgnorer
}

func NewSignalHandler(router *mux.Router, api *pluginapi.Client, logger bot.Logger, incidentService incident.Service, playbookService playbook.Service, keywordsIgnorer playbook.KeywordsIgnorer) *SignalHandler {
	handler := &SignalHandler{
		ErrorHandler:    &ErrorHandler{log: logger},
		api:             api,
		incidentService: incidentService,
		playbookService: playbookService,
		keywordsIgnorer: keywordsIgnorer,
	}

	signalRouter := router.PathPrefix("/signal").Subrouter()

	keywordsRouter := signalRouter.PathPrefix("/keywords").Subrouter()
	keywordsRouter.HandleFunc("/run-playbook", handler.playbookRun).Methods(http.MethodPost)
	keywordsRouter.HandleFunc("/ignore", handler.ignoreKeywords).Methods(http.MethodPost)

	return handler
}

func (h *SignalHandler) playbookRun(w http.ResponseWriter, r *http.Request) {
	publicErrorMessage := "unable to decode post action integration request"

	req := model.PostActionIntegrationRequestFromJson(r.Body)
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

	postID, err := getStringField("postID", req.Context, w)
	if err != nil {
		h.returnError(publicErrorMessage, err, w)
		return
	}

	pbook, err := h.playbookService.Get(id)
	if err != nil {
		h.returnError("can't get chosen playbook", errors.Wrapf(err, "can't get chosen playbook, id - %s", id), w)
		return
	}

	if err := h.incidentService.OpenCreateIncidentDialog(req.TeamId, req.UserId, req.TriggerId, postID, "", []playbook.Playbook{pbook}, isMobile); err != nil {
		h.returnError("can't open dialog", errors.Wrap(err, "can't open a dialog"), w)
		return
	}

	d := map[string]string{"ephemeral_text": fmt.Sprintf("You selected %v", pbook.Title)}
	ReturnJSON(w, &d, http.StatusOK)
}

func (h *SignalHandler) ignoreKeywords(w http.ResponseWriter, r *http.Request) {
	publicErrorMessage := "unable to decode post action integration request"

	req := model.PostActionIntegrationRequestFromJson(r.Body)

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

	h.keywordsIgnorer.Ignore(postID, post.UserId)
	if post.RootId != "" {
		h.keywordsIgnorer.Ignore(post.RootId, post.UserId)
	}

	d := map[string]string{"ephemeral_text": "This thread will be ignored"}
	ReturnJSON(w, &d, http.StatusOK)
}

func (h *SignalHandler) returnError(returnMessage string, err error, w http.ResponseWriter) {
	d := map[string]string{"ephemeral_text": returnMessage}
	h.log.Errorf(err.Error())
	ReturnJSON(w, &d, http.StatusOK)
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
