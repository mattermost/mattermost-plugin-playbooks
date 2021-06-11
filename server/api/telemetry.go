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
	playbookRunService   app.PlaybookRunService
	playbookRunTelemetry app.PlaybookRunTelemetry
	botTelemetry         bot.Telemetry
	pluginAPI            *pluginapi.Client
}

// NewTelemetryHandler Creates a new Plugin API handler.
func NewTelemetryHandler(router *mux.Router, playbookRunService app.PlaybookRunService,
	api *pluginapi.Client, log bot.Logger, playbookRunTelemetry app.PlaybookRunTelemetry, botTelemetry bot.Telemetry, configService config.Service) *TelemetryHandler {
	handler := &TelemetryHandler{
		ErrorHandler:         &ErrorHandler{log: log},
		playbookRunService:   playbookRunService,
		playbookRunTelemetry: playbookRunTelemetry,
		botTelemetry:         botTelemetry,
		pluginAPI:            api,
	}

	telemetryRouter := router.PathPrefix("/telemetry").Subrouter()

	startTrialRouter := telemetryRouter.PathPrefix("/start-trial").Subrouter()
	startTrialRouter.HandleFunc("", handler.startTrial).Methods(http.MethodPost)

	playbookRunTelemetryRouterAuthorized := telemetryRouter.PathPrefix("/run").Subrouter()
	playbookRunTelemetryRouterAuthorized.Use(handler.checkViewPermissions)
	playbookRunTelemetryRouterAuthorized.HandleFunc("/{id:[A-Za-z0-9]+}", handler.telemetryForPlaybookRun).Methods(http.MethodPost)

	return handler
}

func (h *TelemetryHandler) checkViewPermissions(next http.Handler) http.Handler {
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
