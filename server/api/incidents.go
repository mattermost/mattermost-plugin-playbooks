package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
)

// IncidentHandler is the API handler.
type IncidentHandler struct {
	incidentService incident.Service
}

// NewIncidentHandler Creates a new Plugin API handler.
func NewIncidentHandler(router *mux.Router, incidentService incident.Service) *IncidentHandler {
	handler := &IncidentHandler{
		incidentService: incidentService,
	}

	incidentsRouter := router.PathPrefix("/incidents").Subrouter()
	incidentsRouter.HandleFunc("", handler.createIncident).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("", handler.getIncidents).Methods(http.MethodGet)

	incidentRouter := incidentsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	incidentRouter.HandleFunc("", handler.getIncident).Methods(http.MethodGet)

	return handler
}

func (h *IncidentHandler) createIncident(w http.ResponseWriter, r *http.Request) {
	_, err := h.incidentService.CreateIncident(nil)
	if err != nil {
		HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) getIncidents(w http.ResponseWriter, r *http.Request) {
	incidentHeaders, err := h.incidentService.GetAllHeaders()
	if err != nil {
		HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(incidentHeaders)
	if err != nil {
		HandleError(w, err)
		return
	}

	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) getIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incident, err := h.incidentService.GetIncident(vars["id"])
	if err != nil {
		HandleError(w, err)
		return
	}

	jsonBytes, err := json.Marshal(incident)
	if err != nil {
		HandleError(w, err)
		return
	}

	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}
