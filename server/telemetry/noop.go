package telemetry

import (
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
)

// NoopTelemetry satisfies the Telemetry interface with no-op implementations.
type NoopTelemetry struct{}

// CreateIncident does nothing, always returning a nil error.
func (t *NoopTelemetry) CreateIncident(incident *incident.Incident) error {
	return nil
}

// EndIncident does nothing, always returning a nil error.
func (t *NoopTelemetry) EndIncident(incident *incident.Incident) error {
	return nil
}
