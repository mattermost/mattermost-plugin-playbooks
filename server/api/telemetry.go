package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
)

// TelemetryHandler is the API handler.
type TelemetryHandler struct {
	*ErrorHandler
	incidentService   app.IncidentService
	incidentTelemetry app.IncidentTelemetry
	botTelemetry      bot.Telemetry
	pluginAPI         *pluginapi.Client
}

// NewTelemetryHandler Creates a new Plugin API handler.
func NewTelemetryHandler(router *mux.Router, incidentService app.IncidentService,
	api *pluginapi.Client, log bot.Logger, incidentTelemetry app.IncidentTelemetry, botTelemetry bot.Telemetry, configService config.Service) *TelemetryHandler {
	handler := &TelemetryHandler{
		ErrorHandler:      &ErrorHandler{log: log},
		incidentService:   incidentService,
		incidentTelemetry: incidentTelemetry,
		botTelemetry:      botTelemetry,
		pluginAPI:         api,
	}

	telemetryRouter := router.PathPrefix("/telemetry").Subrouter()

	startTrialRouter := telemetryRouter.PathPrefix("/start-trial").Subrouter()
	startTrialRouter.HandleFunc("", handler.startTrial).Methods(http.MethodPost)

	incidentTelemetryRouterAuthorized := telemetryRouter.PathPrefix("/incident").Subrouter()
	incidentTelemetryRouterAuthorized.Use(handler.checkViewPermissions)
	incidentTelemetryRouterAuthorized.HandleFunc("/{id:[A-Za-z0-9]+}", handler.telemetryForIncident).Methods(http.MethodPost)

	return handler
}

func (h *TelemetryHandler) checkViewPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		incdnt, err := h.incidentService.GetIncident(vars["id"])
		if err != nil {
			h.HandleError(w, err)
			return
		}

		if err := app.ViewIncidentFromChannelID(userID, incdnt.ChannelID, h.pluginAPI); err != nil {
			if errors.Is(err, app.ErrNoPermissions) {
				h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err)
				return
			}
			h.HandleError(w, err)
			return
		}

		next.ServeHTTP(w, r)
	})
}

type TrackerPayload struct {
	Action string `json:"action"`
}

// telemetryForIncident handles the /telemetry/incident/{id}?action=the_action endpoint. The frontend
// can use this endpoint to track events that occur in the context of an incident
func (h *TelemetryHandler) telemetryForIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var params TrackerPayload
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode post body", err)
		return
	}

	if params.Action == "" {
		h.HandleError(w, errors.New("must provide action"))
		return
	}

	incdnt, err := h.incidentService.GetIncident(id)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	h.incidentTelemetry.FrontendTelemetryForIncident(incdnt, userID, params.Action)

	w.WriteHeader(http.StatusNoContent)
}

func (h *TelemetryHandler) startTrial(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var params TrackerPayload
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode post body", err)
		return
	}

	switch params.Action {
	case "start_trial_to_view_timeline":
		h.botTelemetry.StartTrialToViewTimeline(userID)
	case "start_trial_to_add_message_to_timeline":
		h.botTelemetry.StartTrialToAddMessageToTimeline(userID)
	case "start_trial_to_create_playbook":
		h.botTelemetry.StartTrialToCreatePlaybook(userID)
	case "start_trial_to_restrict_playbook_creation":
		h.botTelemetry.StartTrialToRestrictPlaybookCreation(userID)
	case "start_trial_to_restrict_playbook_access":
		h.botTelemetry.StartTrialToRestrictPlaybookAccess(userID)
	default:
		h.HandleError(w, errors.New("unknown action"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
