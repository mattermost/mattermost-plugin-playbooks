package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

const PluginIDContextValue = "plugin_id"

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

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request, fromPluginID string) {
	h.root.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), PluginIDContextValue, fromPluginID)))
}

func HandleError(w http.ResponseWriter, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	b, _ := json.Marshal(struct {
		Error   string `json:"error"`
		Details string `json:"details"`
	}{
		Error:   "An internal error has occurred. Check app server logs for details.",
		Details: err.Error(),
	})
	_, _ = w.Write(b)
}

func HandleErrorWithCode(w http.ResponseWriter, code int, errTitle string, err error) {
	w.WriteHeader(code)
	b, _ := json.Marshal(struct {
		Error   string `json:"error"`
		Details string `json:"details"`
	}{
		Error:   errTitle,
		Details: err.Error(),
	})
	_, _ = w.Write(b)
}

func MattermostAuthorizationRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		if userID != "" {
			next.ServeHTTP(w, r)
			return
		}

		pluginID, ok := r.Context().Value(PluginIDContextValue).(string)
		if ok && pluginID != "" {
			next.ServeHTTP(w, r)
			return
		}

		http.Error(w, "Not authorized", http.StatusUnauthorized)
	})
}
