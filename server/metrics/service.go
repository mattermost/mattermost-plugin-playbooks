package metrics

import (
	"net/http"

	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// Service prometheus to run the server.
type Service struct {
	*http.Server
}

type ErrorLoggerWrapper struct {
	log *pluginapi.LogService
}

func (el *ErrorLoggerWrapper) Println(v ...interface{}) {
	el.log.Error("metric server error", v)
}

// NewMetricsServer factory method to create a new prometheus server.
func NewMetricsServer(address string, metricsService *Metrics, logger *pluginapi.LogService) *Service {
	return &Service{
		&http.Server{
			Addr: address,
			Handler: promhttp.HandlerFor(metricsService.registry, promhttp.HandlerOpts{
				ErrorLog: &ErrorLoggerWrapper{
					log: logger,
				},
			}),
		},
	}
}

// Run will start the prometheus server.
func (h *Service) Run() error {
	return errors.Wrap(h.Server.ListenAndServe(), "prometheus ListenAndServe")
}

// Shutdown will shutdown the prometheus server.
func (h *Service) Shutdown() error {
	return errors.Wrap(h.Server.Close(), "prometheus Close")
}
