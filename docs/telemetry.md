# Telemetry

We only track the events that create, delete, or update items. We never track the specific content of the items. In particular, we do not collect the name of the incidents or the contents of the stages and tasks.

Every event we track is accompanied with some metadata that help us group events by server. If that server is licensed, we are able to identify the contact person for the license. Otherwise, we are not able to connect personally identifying information from the event data described below. For example, although we collect the `UserActualId` of the user initiating the event, we are unable to connect personal information to that userId. That userId is used only to aggregate, analyze, and display data.

The following list details the types of metadata we collect:

- `incidentID`: Unique identifier of the incident.
- `IsActive`: Boolean  value indicating if the incident is active.
- `CommanderUserID`: Unique identifier of the commander of the incident.
- `TeamID`: Unique identifier of the team where the incident channel is created
- `CreatedAt`: Timestamp of the incident creation
- `PostID`: Unique identifier of the post from which the incident was created (if relevant)
- `NumChecklists`: Number of stages in this incident. 
- `TotalChecklistItems`: Number of checklist items this incident starts with. It always equals 0.
- `diagnosticID`: Unique identifier of the server the plugin is running on.
- `serverVersion`: Version of the server the plugin is running on.
- `pluginVersion`: Version of the plugin.
- `eventTimeStamp`: Timestamp indicating when the event was queued to send to the server.

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
