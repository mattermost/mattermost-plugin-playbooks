package incident

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-response/server/api"
)

// Handler Plugin API handler.
type Handler struct {
	incidentService Service
}

// NewHandler Creates a new Plugin API handler.
func NewHandler(router *mux.Router, incidentService Service) *Handler {
	handler := &Handler{
		incidentService: incidentService,
	}

	incidentRouter := router.PathPrefix("/incidents").Subrouter()
	incidentRouter.HandleFunc("", handler.newIncident).Methods(http.MethodPost)
	incidentRouter.HandleFunc("", handler.getIncidents).Methods(http.MethodGet)

	return handler
}

func (h *Handler) newIncident(w http.ResponseWriter, r *http.Request) {
	_, err := h.incidentService.CreateIncident(nil)
	if err != nil {
		api.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) getIncidents(w http.ResponseWriter, r *http.Request) {
	incidentHeaders, err := h.incidentService.GetAllHeaders()
	if err != nil {
		api.HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(incidentHeaders)
	if err != nil {
		api.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(jsonBytes)
}
