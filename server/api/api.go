package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
)

// Handler Root API handler.
type Handler struct {
	APIRouter *mux.Router
	root      *mux.Router
}

// NewHandler constructs a new handler.
func NewHandler(config config.Service) *Handler {
	handler := &Handler{}

	root := mux.NewRouter()
	api := root.PathPrefix("/api/v0").Subrouter()
	api.Use(MattermostAuthorizationRequired)

	api.Handle("{anything:.*}", http.NotFoundHandler())
	api.NotFoundHandler = http.NotFoundHandler()

	handler.APIRouter = api
	handler.root = root

	return handler
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.root.ServeHTTP(w, r)
}

// ReturnJSON writes the given pointer to object as json with a success response
func ReturnJSON(w http.ResponseWriter, pointerToObject interface{}, httpStatus int) {
	jsonBytes, err := json.Marshal(pointerToObject)
	if err != nil {
		HandleError(w, errors.Wrapf(err, "unable to marshal json"))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)

	if _, err = w.Write(jsonBytes); err != nil {
		HandleError(w, err)
		return
	}
}

// HandleError logs the internal error and sends a generic error as JSON in a 500 response.
func HandleError(w http.ResponseWriter, internalErr error) {
	HandleErrorWithCode(w, http.StatusInternalServerError, "An internal error has occurred. Check app server logs for details.", internalErr)
}

// HandleErrorWithCode logs the internal error and sends the public facing error
// message as JSON in a response with the provided code.
func HandleErrorWithCode(w http.ResponseWriter, code int, publicErrorMsg string, internalErr error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	details := ""
	if internalErr != nil {
		details = internalErr.Error()
	}

	loggedMsg, _ := json.Marshal(struct {
		Message string `json:"message"` // A public facing message providing details about the error.
		Details string `json:"details"` // More details, potentially sensitive, about the error.
	}{
		Message: publicErrorMsg,
		Details: details,
	})
	logrus.Warn(string(loggedMsg))

	responseMsg, _ := json.Marshal(struct {
		Error string `json:"error"` // A public facing message providing details about the error.
	}{
		Error: publicErrorMsg,
	})
	_, _ = w.Write(responseMsg)
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
