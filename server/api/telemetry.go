package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
)

// TelemetryHandler is the API handler.
type TelemetryHandler struct {
	*ErrorHandler
	playbookRunService   app.PlaybookRunService
	playbookRunTelemetry app.PlaybookRunTelemetry
	playbookService      app.PlaybookService
	permissions          *app.PermissionsService
	playbookTelemetry    app.PlaybookTelemetry
	botTelemetry         bot.Telemetry
	pluginAPI            *pluginapi.Client
}

// NewTelemetryHandler Creates a new Plugin API handler.
func NewTelemetryHandler(
	router *mux.Router,
	playbookRunService app.PlaybookRunService,
	api *pluginapi.Client,
	playbookRunTelemetry app.PlaybookRunTelemetry,
	playbookService app.PlaybookService,
	playbookTelemetry app.PlaybookTelemetry,
	botTelemetry bot.Telemetry,
	permissions *app.PermissionsService,
) *TelemetryHandler {
	handler := &TelemetryHandler{
		ErrorHandler:         &ErrorHandler{},
		playbookRunService:   playbookRunService,
		playbookRunTelemetry: playbookRunTelemetry,
		playbookService:      playbookService,
		playbookTelemetry:    playbookTelemetry,
		botTelemetry:         botTelemetry,
		pluginAPI:            api,
		permissions:          permissions,
	}

	telemetryRouter := router.PathPrefix("/telemetry").Subrouter()

	startTrialRouter := telemetryRouter.PathPrefix("/start-trial").Subrouter()
	startTrialRouter.HandleFunc("", withContext(handler.startTrial)).Methods(http.MethodPost)

	playbookRunTelemetryRouterAuthorized := telemetryRouter.PathPrefix("/run").Subrouter()
	playbookRunTelemetryRouterAuthorized.Use(handler.checkPlaybookRunViewPermissions)
	playbookRunTelemetryRouterAuthorized.HandleFunc("/{id:[A-Za-z0-9]+}", withContext(handler.telemetryForPlaybookRun)).Methods(http.MethodPost)

	playbookTelemetryRouterAuthorized := telemetryRouter.PathPrefix("/playbook").Subrouter()
	playbookTelemetryRouterAuthorized.Use(handler.checkPlaybookViewPermissions)
	playbookTelemetryRouterAuthorized.HandleFunc("/{id:[A-Za-z0-9]+}", withContext(handler.telemetryForPlaybook)).Methods(http.MethodPost)

	templateRouter := telemetryRouter.PathPrefix("/template").Subrouter()
	templateRouter.HandleFunc("", withContext(handler.telemetryForTemplate))

	return handler
}

func (h *TelemetryHandler) checkPlaybookRunViewPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")
		runID := vars["id"]

		if err := h.permissions.RunView(userID, runID); err != nil {
			logger := getLogger(r)
			if errors.Is(err, app.ErrNoPermissions) {
				h.HandleErrorWithCode(w, logger, http.StatusForbidden, "Not authorized", err)
				return
			}
			h.HandleError(w, logger, err)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (h *TelemetryHandler) checkPlaybookViewPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")
		playbookID := vars["id"]

		if err := h.permissions.PlaybookView(userID, playbookID); err != nil {
			logger := getLogger(r)
			if errors.Is(err, app.ErrNoPermissions) {
				h.HandleErrorWithCode(w, logger, http.StatusForbidden, "Not authorized", err)
				return
			}
			h.HandleError(w, logger, err)
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
func (h *TelemetryHandler) telemetryForPlaybookRun(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var params TrackerPayload
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode post body", err)
		return
	}

	if params.Action == "" {
		h.HandleError(w, c.logger, errors.New("must provide action"))
		return
	}

	playbookRun, err := h.playbookRunService.GetPlaybookRun(id)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	h.playbookRunTelemetry.FrontendTelemetryForPlaybookRun(playbookRun, userID, params.Action)

	w.WriteHeader(http.StatusNoContent)
}

func (h *TelemetryHandler) startTrial(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var params TrackerPayload
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode post body", err)
		return
	}

	h.botTelemetry.StartTrial(userID, params.Action)

	w.WriteHeader(http.StatusNoContent)
}

// telemetryForPlaybook handles the /telemetry/playbook/{id}?action=the_action endpoint. The frontend
// can use this endpoint to track events that occur in the context of a playbook.
func (h *TelemetryHandler) telemetryForPlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var params TrackerPayload
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode post body", err)
		return
	}

	if params.Action == "" {
		h.HandleError(w, c.logger, errors.New("must provide action"))
		return
	}

	playbook, err := h.playbookService.Get(id)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	h.playbookTelemetry.FrontendTelemetryForPlaybook(playbook, userID, params.Action)

	w.WriteHeader(http.StatusNoContent)
}

func (h *TelemetryHandler) telemetryForTemplate(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		TemplateName string `json:"template_name"`
		Action       string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode post body", err)
		return
	}

	if params.TemplateName == "" {
		h.HandleError(w, c.logger, errors.New("must provide template_name"))
		return
	}
	if params.Action == "" {
		h.HandleError(w, c.logger, errors.New("must provide action"))
		return
	}

	h.playbookTelemetry.FrontendTelemetryForPlaybookTemplate(params.TemplateName, userID, params.Action)

	w.WriteHeader(http.StatusNoContent)
}
