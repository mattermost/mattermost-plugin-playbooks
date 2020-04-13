package telemetry

import (
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
)

// NoopTelemetry implements all Telemetry functions as no-op
type NoopTelemetry struct{}

// TrackIncidentNew does nothing, returnin always nil
func (t *NoopTelemetry) TrackIncidentNew(incident *incident.Incident) error {
	return nil
}

// TrackIncidentEnd does nothing, returnin always nil
func (t *NoopTelemetry) TrackIncidentEnd(incident *incident.Incident) error {
	return nil
}
