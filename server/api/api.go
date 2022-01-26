package api

import (
	"encoding/json"
	"net/http"

	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// Handler Root API handler.
type Handler struct {
	*ErrorHandler
	pluginAPI  *pluginapi.Client
	APIRouter  *mux.Router
	APIQRouter *mux.Router
	root       *mux.Router
	config     config.Service
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

	apiq := root.PathPrefix("/api/v1").Subrouter()
	apiq.Use(MattermostAuthorizationRequired)

	apiq.Handle("{anything:.*}", http.NotFoundHandler())
	apiq.NotFoundHandler = http.NotFoundHandler()

	handler.APIRouter = api
	handler.APIQRouter = apiq
	handler.root = root
	handler.config = config

	return handler
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.root.ServeHTTP(w, r)
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

	logger.Errorf("public error message: %v; internal details: %v", publicErrorMsg, details)

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
