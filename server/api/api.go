package api

import (
	"encoding/json"
	"net/http"

	"github.com/sirupsen/logrus"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
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
func NewHandler(pluginAPI *pluginapi.Client, config config.Service, logger logrus.FieldLogger) *Handler {
	handler := &Handler{
		ErrorHandler: &ErrorHandler{},
		pluginAPI:    pluginAPI,
		config:       config,
	}

	root := mux.NewRouter()
	api := root.PathPrefix("/api/v0").Subrouter()
	api.Use(LogRequest)
	api.Use(MattermostAuthorizationRequired)

	api.Handle("{anything:.*}", http.NotFoundHandler())
	api.NotFoundHandler = http.NotFoundHandler()

	handler.APIRouter = api
	handler.root = root
	handler.config = config

	return handler
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.root.ServeHTTP(w, r)
}

// handleResponseWithCode logs the internal error and sends the public facing error
// message as JSON in a response with the provided code.
func handleResponseWithCode(w http.ResponseWriter, code int, publicMsg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	responseMsg, _ := json.Marshal(struct {
		Error string `json:"error"` // A public facing message providing details about the error.
	}{
		Error: publicMsg,
	})
	_, _ = w.Write(responseMsg)
}

// HandleErrorWithCode logs the internal error and sends the public facing error
// message as JSON in a response with the provided code.
func HandleErrorWithCode(logger logrus.FieldLogger, w http.ResponseWriter, code int, publicErrorMsg string, internalErr error) {
	if internalErr != nil {
		logger = logger.WithError(internalErr)
	}

	logger.Warn(publicErrorMsg)

	handleResponseWithCode(w, code, publicErrorMsg)
}

// ReturnJSON writes the given pointerToObject as json with the provided httpStatus
func ReturnJSON(w http.ResponseWriter, pointerToObject interface{}, httpStatus int) {
	jsonBytes, err := json.Marshal(pointerToObject)
	if err != nil {
		logrus.WithError(err).Warn("Unable to marshall JSON")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)

	if _, err = w.Write(jsonBytes); err != nil {
		logrus.WithError(err).Warn("Unable to write to http.ResponseWriter")
		return
	}
}

// MattermostAuthorizationRequired checks if request is authorized.
func MattermostAuthorizationRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-Id")
		if userID != "" {
			next.ServeHTTP(w, r)
			return
		}

		http.Error(w, "Not authorized", http.StatusUnauthorized)
	})
}
