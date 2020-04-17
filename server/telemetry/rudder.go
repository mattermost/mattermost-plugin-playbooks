package telemetry

import (
	"fmt"

	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	rudder "github.com/rudderlabs/analytics-go"
)

// RudderTelemetry implements Telemetry using a Rudder backend.
type RudderTelemetry struct {
	client        rudder.Client
	diagnosticID  string
	serverVersion string
}

const (
	// eventCreateIncident is the Event string sent to Rudder when a new incident is created
	eventCreateIncident = "CreateIncident"

	// eventEndIncident is the Event string sent to Rudder when an incident is ended
	eventEndIncident = "EndIncident"
)

// NewRudder builds a new RudderTelemetry client that will send the events to
// dataPlaneURL with the writeKey, identified with the diagnosticID. The
// version of the server is also sent with every event tracked.
// If either diagnosticID or serverVersion are empty, an error is returned.
func NewRudder(dataPlaneURL, writeKey, diagnosticID string, serverVersion string) (*RudderTelemetry, error) {
	if diagnosticID == "" {
		return nil, fmt.Errorf("diagnosticID should not be empty")
	}

	if serverVersion == "" {
		return nil, fmt.Errorf("serverVersion should not be empty")
	}

	client, err := rudder.NewWithConfig(writeKey, rudder.Config{
		Endpoint: dataPlaneURL,
	})
	if err != nil {
		return nil, err
	}

	return &RudderTelemetry{client, diagnosticID, serverVersion}, nil
}

func (t *RudderTelemetry) track(event string, properties map[string]interface{}) {
	properties["PluginVersion"] = config.Manifest.Version
	properties["ServerVersion"] = t.serverVersion

	t.client.Enqueue(rudder.Track{
		UserId:     t.diagnosticID,
		Event:      event,
		Properties: properties,
	})
}

func incidentProperties(incident *incident.Incident) map[string]interface{} {
	return map[string]interface{}{
		"ID":              incident.ID,
		"IsActive":        incident.IsActive,
		"CommanderUserID": incident.CommanderUserID,
		"TeamID":          incident.TeamID,
		"CreatedAt":       incident.CreatedAt,
		"ChannelIDs":      incident.ChannelIDs,
		"PostID":          incident.PostID,
		// TODO: Add ChecklistItemsCount when ready
	}
}

// CreateIncident tracks the creation of the incident passed.
func (t *RudderTelemetry) CreateIncident(incident *incident.Incident) {
	t.track(eventCreateIncident, incidentProperties(incident))
}

// EndIncident tracks the end of the incident passed.
func (t *RudderTelemetry) EndIncident(incident *incident.Incident) {
	t.track(eventEndIncident, incidentProperties(incident))
}
