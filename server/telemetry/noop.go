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

// AddChecklistItem does nothing.
func (t *NoopTelemetry) AddChecklistItem(incidentID, userID string) {
}

// RemoveChecklistItem does nothing.
func (t *NoopTelemetry) RemoveChecklistItem(incidentID, userID string) {
}

// EditChecklistItem does nothing.
func (t *NoopTelemetry) EditChecklistItem(incidentID, userID string) {
}

// CheckChecklistItem does nothing.
func (t *NoopTelemetry) CheckChecklistItem(incidentID, userID string) {
}

// UncheckChecklistItem does nothing.
func (t *NoopTelemetry) UncheckChecklistItem(incidentID, userID string) {
}
