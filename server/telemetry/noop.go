package telemetry

import (
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
)

// NoopTelemetry satisfies the Telemetry interface with no-op implementations.
type NoopTelemetry struct{}

// CreateIncident does nothing
func (t *NoopTelemetry) CreateIncident(incident *incident.Incident) {
}

// EndIncident does nothing
func (t *NoopTelemetry) EndIncident(incident *incident.Incident) {
}
