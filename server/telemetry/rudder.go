package telemetry

import (
	"fmt"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	rudder "github.com/rudderlabs/analytics-go"
)

// RudderTelemetry implements Telemetry using a Rudder backend.
type RudderTelemetry struct {
	client       rudder.Client
	diagnosticID string
}

const (
	// eventCreateIncident is the Event string sent to Rudder when a new incident is created
	eventCreateIncident = "CreateIncident"

	// eventEndIncident is the Event string sent to Rudder when an incident is ended
	eventEndIncident = "EndIncident"
)

// NewRudder builds a new RudderTelemetry client that will send the events to
// dataPlaneURL with the writeKey, identified with the diagnosticID
func NewRudder(dataPlaneURL, writeKey, diagnosticID string) (*RudderTelemetry, error) {
	if diagnosticID == "" {
		return nil, fmt.Errorf("diagnosticID should not be empty")
	}

	client, err := rudder.NewWithConfig(writeKey, rudder.Config{
		Endpoint: dataPlaneURL,
	})
	if err != nil {
		return nil, err
	}

	return &RudderTelemetry{client, diagnosticID}, nil
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
		"Header": map[string]interface{}{
			"ID":              incident.ID,
			"Name":            incident.Name,
			"IsActive":        incident.IsActive,
			"CommanderUserID": incident.CommanderUserID,
			"TeamID":          incident.TeamID,
			"CreatedAt":       incident.CreatedAt,
		},
		"ChannelIDs": incident.ChannelIDs,
		"PostID":     incident.PostID,
	}
}

// CreateIncident tracks the creation of the incident passed. The returned
// error is, for now, always nil.
func (t *RudderTelemetry) CreateIncident(incident *incident.Incident) error {
	t.track(eventCreateIncident, incidentProperties(incident))
	return nil
}

// EndIncident tracks the end of the incident passed. The returned
// error is, for now, always nil.
func (t *RudderTelemetry) EndIncident(incident *incident.Incident) error {
	t.track(eventEndIncident, incidentProperties(incident))
	return nil
}
