package api

import (
	"context"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/sirupsen/logrus"
)

// statusRecorder intercepts and saves the status code written to an http.ResponseWriter.
type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *statusRecorder) WriteHeader(code int) {
	// Forward the write
	r.ResponseWriter.WriteHeader(code)

	// Save the status code
	r.statusCode = code
}

// LogRequest logs each request, attaching a unique request_id to the request context to trace
// logs throughout the request lifecycle.
func LogRequest(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recorder := statusRecorder{w, 200}
		requestID := model.NewId()

		logger := logrus.WithFields(logrus.Fields{
			"method":     r.Method,
			"url":        r.URL.String(),
			"user_id":    r.Header.Get("Mattermost-User-Id"),
			"request_id": requestID,
			"user_agent": r.Header.Get("User-Agent"),
		})
		r = r.WithContext(context.WithValue(r.Context(), requestIDContextKey, requestID))

		logger.Debug("Received HTTP request")

		next.ServeHTTP(&recorder, r)

		logger.WithField("status", recorder.statusCode).Debug("Handled HTTP request")
	})
}
