package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

type contextKey string

// PluginIDContextKey Key used to store the sourcePluginID for http requests.
const PluginIDContextKey = "plugin_id"

// Handler Root API handler.
type Handler struct {
	APIRouter *mux.Router
	root      *mux.Router
}

// NewHandler constructs a new handler.
func NewHandler() *Handler {
	handler := &Handler{}

	root := mux.NewRouter()
	api := root.PathPrefix("/api/v1").Subrouter()
	api.Use(MattermostAuthorizationRequired)
	api.Handle("{anything:.*}", http.NotFoundHandler())
	api.NotFoundHandler = http.NotFoundHandler()

	handler.APIRouter = api
	handler.root = root

	return handler
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request, sourcePluginID string) {
	h.root.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), contextKey(PluginIDContextKey), sourcePluginID)))
}

// HandleError writes err as json into the response.
func HandleError(w http.ResponseWriter, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	b, _ := json.Marshal(struct {
		Error   string `json:"error"`
		Details string `json:"details"`
	}{
		Error:   "An internal error has occurred. Check app server logs for details.",
		Details: err.Error(),
	})
	logrus.Warn(string(b))
	_, _ = w.Write(b)
}

// ReturnJSON writes the given pointer to object as json with a success response
func ReturnJSON(w http.ResponseWriter, pointerToObject interface{}) {
	jsonBytes, err := json.Marshal(pointerToObject)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "unable to marshal json"))
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(jsonBytes)
}

// HandleErrorWithCode writes code, errTitle and err as json into the response.
func HandleErrorWithCode(w http.ResponseWriter, code int, errTitle string, err error) {
	w.WriteHeader(code)
	details := ""
	if err != nil {
		details = err.Error()
	}
	b, _ := json.Marshal(struct {
		Error   string `json:"error"`
		Details string `json:"details"`
	}{
		Error:   errTitle,
		Details: details,
	})
	logrus.Warn(string(b))
	_, _ = w.Write(b)
}

// MattermostAuthorizationRequired checks if request is authorized.
func MattermostAuthorizationRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		if userID != "" {
			next.ServeHTTP(w, r)
			return
		}

		pluginID, ok := r.Context().Value(PluginIDContextKey).(string)
		if ok && pluginID != "" {
			next.ServeHTTP(w, r)
			return
		}

		http.Error(w, "Not authorized", http.StatusUnauthorized)
	})
}
