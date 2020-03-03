package incident

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-starter-template/server/api"
)

type Handler struct {
	incidentService Service
}

func NewHandler(router *mux.Router, incidentService Service) *Handler {
	handler := &Handler{
		incidentService: incidentService,
	}

	incidentRouter := router.PathPrefix("/incident").Subrouter()
	incidentRouter.HandleFunc("", handler.newIncident).Methods(http.MethodPost)
	incidentRouter.HandleFunc("", handler.getIncident).Methods(http.MethodGet)

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

func (h *Handler) getIncident(w http.ResponseWriter, r *http.Request) {
	_, err := h.incidentService.GetIncident("")
	if err != nil {
		api.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}
