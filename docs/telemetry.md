# Telemetry

We only track the events that create, delete, or update items. We never track the specific content of the items. In particular, we do not collect the name of the incidents or the contents of the stages and tasks.

Every event we track is accompanied with some metadata that help us group events by server. If that server is licensed, we are able to identify the contact person for the license. Otherwise, we are not able to connect personally identifying information from the event data described below. For example, although we collect the `UserActualId` of the user initiating the event, we are unable to connect personal information to that userId. That userId is used only to aggregate, analyze, and display data.

The following list details the types of metadata we collect:

## Data collected for all event types

- `serverVersion`: Version of the server the plugin is running on.
- `pluginVersion`: Version of the plugin.
- `eventTimeStamp`: Timestamp indicating when the event was queued to send to the server.
- `event originalTimestamp`: Timestamp indicating when the event actually happened. It always equals `eventTimeStamp`.
- `UserID`: Unique identifier of the server.
- `UserActualID`: Unique identifier of the user who initiated the action.
- `type`: Type of the event. There are three event types that are tracked: `incident`, `tasks`, `playbook`.

## Data collected in `incident` events

- `incidentID`: Unique identifier of the incident.
- `IsActive`: Boolean  value indicating if the incident is active.
- `CommanderUserID`: Unique identifier of the commander of the incident.
- `TeamID`: Unique identifier of the team where the incident channel is created
- `CreatedAt`: Timestamp of the incident creation.
- `PostID`: Unique identifier of the post from which the incident was created (if relevant).
- `NumChecklists`: Number of stages in this incident.
- `TotalChecklistItems`: Number of tasks in this incident.
- `ActiveStage`: A number indicating the stage of the incident (0-based).
- `Public`: True if the incident was public, false if it was private.

## Data collected in `tasks` events

- `incidentID`: Unique identifier of the incident.
- `NewState`: If the task was marked uncompleted. If the task was marked completed, the result will be `done`.
- `WasCommander`: `true` if the userId who initiated the event was also the commander of the event, `false` if not.
- `WasAssignee`: `true` if the userId who initiated the event was also the assignee of the event, `false` if not.

## Data collected in `playbook` events

- `PlaybookID`: Unique identifier of the playbook.
- `TeamID`: Unique identifier of the team this playbook is associated with.
- `NumChecklists`: Number of stages in this playbook.
- `TotalChecklistItems`: Number of tasks in this incident.
- `IsPublic`: True if the playbook was public, false if it was private.
- `NumMembers`: The number of members with access to this playbook.
- `NumSlashCommands`: The number of slash commands in this playbook.

For more information about telemetry, see [Mattermost Telemetry](https://docs.mattermost.com/administration/telemetry.html).

## Event data

Non-personally Identifiable Diagnostic Information, distinguished by end users and System Admins.

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
