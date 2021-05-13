package api

import (
	"encoding/json"
	"net/http"

	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"

	"github.com/gorilla/mux"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/permissions"
)

// Handler Root API handler.
type Handler struct {
	*ErrorHandler
	pluginAPI *pluginapi.Client
	APIRouter *mux.Router
	root      *mux.Router
	config    config.Service
}

// NewHandler constructs a new handler.
func NewHandler(pluginAPI *pluginapi.Client, config config.Service, log bot.Logger) *Handler {
	handler := &Handler{
		ErrorHandler: &ErrorHandler{log: log},
		pluginAPI:    pluginAPI,
		config:       config,
	}

	root := mux.NewRouter()
	api := root.PathPrefix("/api/v0").Subrouter()
	api.Use(MattermostAuthorizationRequired)

	api.Handle("{anything:.*}", http.NotFoundHandler())
	api.NotFoundHandler = http.NotFoundHandler()

	handler.APIRouter = api
	handler.root = root

	e20Middleware := E20LicenseRequired{config}

	settingsRouter := handler.APIRouter.PathPrefix("/settings").Subrouter()
	settingsRouter.Use(e20Middleware.Middleware)
	settingsRouter.HandleFunc("", handler.getSettings).Methods(http.MethodGet)
	settingsRouter.HandleFunc("", handler.setSettings).Methods(http.MethodPost)

	return handler
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.root.ServeHTTP(w, r)
}

type GlobalSettings struct {
	PlaybookCreatorsUserIds    []string `json:"playbook_creators_user_ids"`
	EnableExperimentalFeatures bool     `json:"enable_experimental_features"`
}

func (h *Handler) getSettings(w http.ResponseWriter, r *http.Request) {
	cfg := h.config.GetConfiguration()
	settings := GlobalSettings{
		PlaybookCreatorsUserIds:    cfg.PlaybookCreatorsUserIds,
		EnableExperimentalFeatures: cfg.EnableExperimentalFeatures,
	}
	ReturnJSON(w, &settings, http.StatusOK)
}

func (h *Handler) setSettings(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var settings GlobalSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode settings", err)
		return
	}

	if err := permissions.ModifySettings(userID, h.config); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err)
		return
	}

	pluginConfig := h.pluginAPI.Configuration.GetPluginConfig()
	pluginConfig["PlaybookCreatorsUserIds"] = settings.PlaybookCreatorsUserIds
	if err := h.pluginAPI.Configuration.SavePluginConfig(pluginConfig); err != nil {
		h.HandleError(w, err)
	}

	w.WriteHeader(http.StatusOK)
}

// HandleErrorWithCode logs the internal error and sends the public facing error
// message as JSON in a response with the provided code.
func HandleErrorWithCode(logger bot.Logger, w http.ResponseWriter, code int, publicErrorMsg string, internalErr error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	details := ""
	if internalErr != nil {
		details = internalErr.Error()
	}

	logger.Warnf("public error message: %v; internal details: %v", publicErrorMsg, details)

	responseMsg, _ := json.Marshal(struct {
		Error string `json:"error"` // A public facing message providing details about the error.
	}{
		Error: publicErrorMsg,
	})
	_, _ = w.Write(responseMsg)
}

// ReturnJSON writes the given pointerToObject as json with the provided httpStatus
func ReturnJSON(w http.ResponseWriter, pointerToObject interface{}, httpStatus int) {
	jsonBytes, err := json.Marshal(pointerToObject)
	if err != nil {
		logrus.Warnf("Unable to marshall JSON. Error details: %s", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)

	if _, err = w.Write(jsonBytes); err != nil {
		logrus.Warnf("Unable to write to http.ResponseWriter. Error details: %s", err.Error())
		return
	}
}

// MattermostAuthorizationRequired checks if request is authorized.
func MattermostAuthorizationRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		if userID != "" {
			next.ServeHTTP(w, r)
			return
		}

		http.Error(w, "Not authorized", http.StatusUnauthorized)
	})
}

type E20LicenseRequired struct {
	config config.Service
}

// Middleware checks if the server is appropriately licensed.
func (m *E20LicenseRequired) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !m.config.IsLicensed() {
			http.Error(w, "E20 license required", http.StatusForbidden)

			return
		}

		next.ServeHTTP(w, r)
	})
}
