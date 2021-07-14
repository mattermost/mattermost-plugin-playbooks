package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
)

// TelemetryHandler is the API handler.
type TelemetryHandler struct {
	*ErrorHandler
	playbookRunService   app.PlaybookRunService
	playbookRunTelemetry app.PlaybookRunTelemetry
	playbookService      app.PlaybookService
	playbookTelemetry    app.PlaybookTelemetry
	botTelemetry         bot.Telemetry
	pluginAPI            *pluginapi.Client
}

// NewTelemetryHandler Creates a new Plugin API handler.
func NewTelemetryHandler(router *mux.Router, playbookRunService app.PlaybookRunService,
	api *pluginapi.Client, log bot.Logger, playbookRunTelemetry app.PlaybookRunTelemetry,
	playbookService app.PlaybookService, playbookTelemetry app.PlaybookTelemetry,
	botTelemetry bot.Telemetry) *TelemetryHandler {
	handler := &TelemetryHandler{
		ErrorHandler:         &ErrorHandler{log: log},
		playbookRunService:   playbookRunService,
		playbookRunTelemetry: playbookRunTelemetry,
		playbookService:      playbookService,
		playbookTelemetry:    playbookTelemetry,
		botTelemetry:         botTelemetry,
		pluginAPI:            api,
	}

	telemetryRouter := router.PathPrefix("/telemetry").Subrouter()

	startTrialRouter := telemetryRouter.PathPrefix("/start-trial").Subrouter()
	startTrialRouter.HandleFunc("", handler.startTrial).Methods(http.MethodPost)

	playbookRunTelemetryRouterAuthorized := telemetryRouter.PathPrefix("/run").Subrouter()
	playbookRunTelemetryRouterAuthorized.Use(handler.checkPlaybookRunViewPermissions)
	playbookRunTelemetryRouterAuthorized.HandleFunc("/{id:[A-Za-z0-9]+}", handler.telemetryForPlaybookRun).Methods(http.MethodPost)

	playbookTelemetryRouterAuthorized := telemetryRouter.PathPrefix("/playbook").Subrouter()
	playbookTelemetryRouterAuthorized.Use(handler.checkPlaybookViewPermissions)
	playbookTelemetryRouterAuthorized.HandleFunc("/{id:[A-Za-z0-9]+}", handler.telemetryForPlaybook).Methods(http.MethodPost)

	return handler
}

func (h *TelemetryHandler) checkPlaybookRunViewPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		playbookRun, err := h.playbookRunService.GetPlaybookRun(vars["id"])
		if err != nil {
			h.HandleError(w, err)
			return
		}

		if err := app.ViewPlaybookRunFromChannelID(userID, playbookRun.ChannelID, h.pluginAPI); err != nil {
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

func (h *TelemetryHandler) checkPlaybookViewPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		playbook, err := h.playbookService.Get(vars["id"])
		if err != nil {
			h.HandleError(w, err)
			return
		}

		if err := app.PlaybookAccess(userID, playbook, h.pluginAPI); err != nil {
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

// telemetryForPlaybookRun handles the /telemetry/run/{id}?action=the_action endpoint. The frontend
// can use this endpoint to track events that occur in the context of a playbook run.
func (h *TelemetryHandler) telemetryForPlaybookRun(w http.ResponseWriter, r *http.Request) {
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

	playbookRun, err := h.playbookRunService.GetPlaybookRun(id)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	h.playbookRunTelemetry.FrontendTelemetryForPlaybookRun(playbookRun, userID, params.Action)

	w.WriteHeader(http.StatusNoContent)
}

func (h *TelemetryHandler) startTrial(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var params TrackerPayload
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode post body", err)
		return
	}

	h.botTelemetry.StartTrial(userID, params.Action)

	w.WriteHeader(http.StatusNoContent)
}

// telemetryForPlaybook handles the /telemetry/playbook/{id}?action=the_action endpoint. The frontend
// can use this endpoint to track events that occur in the context of a playbook.
func (h *TelemetryHandler) telemetryForPlaybook(w http.ResponseWriter, r *http.Request) {
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

	playbook, err := h.playbookService.Get(id)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	h.playbookTelemetry.FrontendTelemetryForPlaybook(playbook, userID, params.Action)

	w.WriteHeader(http.StatusNoContent)
}
