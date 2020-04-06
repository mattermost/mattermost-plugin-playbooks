package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/pkg/errors"
)

// PlaybookHandler is the API handler.
type PlaybookHandler struct {
	playbookService playbook.Service
}

// NewPlaybookHandler returns a new playbook api handler
func NewPlaybookHandler(router *mux.Router, playbookService playbook.Service) *PlaybookHandler {
	handler := &PlaybookHandler{
		playbookService: playbookService,
	}

	playbooksRouter := router.PathPrefix("/playbooks").Subrouter()
	playbooksRouter.HandleFunc("", handler.createPlaybook).Methods(http.MethodPost)
	playbooksRouter.HandleFunc("", handler.getPlaybooks).Methods(http.MethodGet)

	playbookRouter := playbooksRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	playbookRouter.HandleFunc("", handler.getPlaybook).Methods(http.MethodGet)
	playbookRouter.HandleFunc("", handler.updatePlaybook).Methods(http.MethodPut)
	playbookRouter.HandleFunc("", handler.deletePlaybook).Methods(http.MethodDelete)

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

func (h *PlaybookHandler) getPlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	playbook, err := h.playbookService.Get(vars["id"])
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, &playbook)
}

func (h *PlaybookHandler) updatePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	var playbook playbook.Playbook
	if err := json.NewDecoder(r.Body).Decode(&playbook); err != nil {
		HandleError(w, errors.Wrap(err, "unable to decode playbook"))
		return
	}

	// Force parsed playbook id to be URL parameter id
	playbook.ID = vars["id"]

	if err := h.playbookService.Update(playbook); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status": "OK"}`))
}

func (h *PlaybookHandler) deletePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	if err := h.playbookService.Delete(vars["id"]); err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status": "OK"}`))
}

func (h *PlaybookHandler) getPlaybooks(w http.ResponseWriter, r *http.Request) {
	playbooks, err := h.playbookService.GetPlaybooks()
	if err != nil {
		HandleError(w, err)
		return
	}

	ReturnJSON(w, &playbooks)
}
