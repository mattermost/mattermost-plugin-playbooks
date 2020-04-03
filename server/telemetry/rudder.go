package telemetry

import (
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	rudder "github.com/rudderlabs/analytics-go"
)

// RudderTelemetry implements Telemetry using a Rudder backend
type RudderTelemetry struct {
	client       rudder.Client
	diagnosticID string
}

func (t *RudderTelemetry) track(event string, properties map[string]interface{}) {
	t.client.Enqueue(rudder.Track{
		UserId:     t.diagnosticID,
		Event:      event,
		Properties: properties,
	})
}

func incidentProperties(incident *incident.Incident) map[string]interface{} {
	return map[string]interface{}{
		"ID":              incident.ID,
		"Name":            incident.Name,
		"IsActive":        incident.IsActive,
		"CommanderUserID": incident.CommanderUserID,
		"TeamID":          incident.TeamID,
		"CreatedAt":       incident.CreatedAt,
		"ChannelIDs":      incident.ChannelIDs,
		"PostID":          incident.PostID,
	}
}

// TrackIncidentNew tracks the creation of the incident passed. The returned
// error is, for now, always nil
func (t *RudderTelemetry) TrackIncidentNew(incident *incident.Incident) error {
	t.track("Incident created", incidentProperties(incident))
	return nil
}

// TrackIncidentEnd tracks the end of the incident passed. The returned
// error is, for now, always nil
func (t *RudderTelemetry) TrackIncidentEnd(incident *incident.Incident) error {
	t.track("Incident finished", incidentProperties(incident))
	return nil
}

// Disable closes the underlying Rudder client, effectively disabling the
// subsequent telemetry events. The events tracked before calling Disable are
// sent immediately to the Rudder server.
func (t *RudderTelemetry) Disable() error {
	return t.client.Close()
}

// NewRudder builds a new RudderTelemetry client that will send the events to
// dataPlaneURL with the writeKey, identified with the diagnosticID
func NewRudder(dataPlaneURL, writeKey, diagnosticID string) (*RudderTelemetry, error) {
	client, err := rudder.NewWithConfig(writeKey, rudder.Config{
		Endpoint: dataPlaneURL,
	})
	if err != nil {
		return nil, err
	}

	return &RudderTelemetry{client, diagnosticID}, nil
}
