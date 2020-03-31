package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/pkg/errors"
)

type PlaybookHandlerPluginAPI interface {
}

// IncidentHandler is the API handler.
type PlaybookHandler struct {
	playbookService playbook.Service
	pluginAPI       PlaybookHandlerPluginAPI
}

func NewPlaybookHandler(router *mux.Router, playbookService playbook.Service, api PlaybookHandlerPluginAPI) *PlaybookHandler {
	handler := &PlaybookHandler{
		playbookService: playbookService,
		pluginAPI:       api,
	}

	playbooksRouter := router.PathPrefix("/playbooks").Subrouter()
	playbooksRouter.HandleFunc("", handler.createPlaybook).Methods(http.MethodPost)
	//playbooksRouter.HandleFunc("", handler.getPlaybooks).Methods(http.MethodGet)

	//playbookRouter := playbooksRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	//playbookRouter.HandleFunc("", handler.getPlaybook).Methods(http.MethodGet)

	return handler
}

func (h *PlaybookHandler) createPlaybook(w http.ResponseWriter, r *http.Request) {
	var playbook playbook.Playbook
	if err := json.NewDecoder(r.Body).Decode(&playbook); err != nil {
		HandleError(w, errors.Wrap(err, "unable to decode playbook"))
		return
	}

	id, err := h.playbookService.Create(playbook)
	if err != nil {
		HandleError(w, err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: id,
	}
	resultBytes, err := json.Marshal(&result)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(resultBytes)
}

//func (h *PlaybookHandler) getPlaybook(w http.ResponseWriter, r *http.Request) {
//}
