# Telemetry

We only track the events that create, delete, or update items. We never track the specific content of the items. In particular, we do not collect the name of the incidents or the contents of the stages and tasks.

Every event we track is accompanied with metadata that help us identify each event and isolate it from the rest of the servers. We can group all events that are coming from a single server, and if that server is licensed, we are able to identify the buyer of the license. The following list details the metadata that accompanies every event:

- `incidentID`: Unique identifier of the incident.
- `userID`: Unique identifier of the user who performed the action.
- `IsActive`: Boolean  value indicating if the incident is active. It always equals `true`
- `CommanderUserID`: Unique identifier of the commander of the incident. It equals the identifier of the user that created the incident
- `TeamID`: Unique identifier of the team where the incident channel is created
- `CreatedAt`: Timestamp of the incident creation
- `ChannelIDs`: A list containing a single element, the channel created along with the incident
- `PostID`: Unique identifier of the post
- `NumChecklists`: Number of checklists. It always equals 1 
- `TotalChecklistItems`: Number of checklist items this incident starts with. It always equals 0.
- `diagnosticID`: Unique identifier of the server the plugin is running on.
- `serverVersion`: Version of the server the plugin is running on.
- `pluginVersion`: Version of the plugin.
- `eventTimeStamp`: Timestamp indicating when the event was queued to send to the server.
- `event integrations`: Unused field. It always contains the value `null`.
- `event originalTimestamp`: Timestamp indicating when the event actually happened. It always equals `eventTimeStamp`.
- `type`: Type of the event. There are three event types that are tracked: `incident`, `tasks`, `playbook`.

For more information about telemetry, see [Mattermost Telemetry](https://docs.mattermost.com/administration/telemetry.html).

## Event data

Non-personally Identifiable Diagnostic Information, distinguished by end users and System Admins

Boolean when the following events occur:

Incidents:

`create`: Tracks the creation of the incident passed.
 - Properties: `actionCreate`;`public`
    
`end`: Tracks the end of the incident passed.
 - Properties: `actionEnd`
    
`restart`: Tracks the restart of the incident.
- Properties: `actionRestart`

`change_commander`: Tracks changes in commander.
 - Properties: `actionChangeCommander`

`change_stage`: Tracks changes in stage.
- Properties: `actionChangeStage`
