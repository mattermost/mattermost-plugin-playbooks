# Telemetry

We only track the events that create, delete, or update items. We never track the specific content of the items. In particular, we do not collect the name of the incidents or the contents of the stages and tasks.

Every event we track is accompanied with metadata that help us identify each event and isolate it from the rest of the servers. We can group all events that are coming from a single server, and if that server is licensed, we are able to identify the buyer of the license. The following list details the metadata that accompanies every event:

- `diagnosticID`: Unique identifier of the server the plugin is running on.
- `serverVersion`: Version of the server the plugin is running on.
- `pluginVersion`: Version of the plugin.
- `eventTimeStamp`: Timestamp indicating when the event was queued to send to the server.
- `createdAt`: Timestamp indicating when the event was sent to the server.
- `id`: Unique identifier of the event.
- `event integrations`: Unused field. It always contains the value `null`.
- `event originalTimestamp`: Timestamp indicating when the event actually happened. It always equals `eventTimeStamp`.
- `type`: Type of the event. There are three event types that are tracked: `incident`, `tasks`, `playbook`.

For more information about telemetry, see [Mattermost Telemetry](https://docs.mattermost.com/administration/telemetry.html).

## Incident data

### Actions and data collected

**Action:** `create`

**Triggers:** Any user sends the `/incident start` slash command and creates an incident; Any user clicks on **+ Start Incident** in **Your Ongoing Incidents** view, in the RHS and creates an incident; Any user clicks on the drop-down menu of any post, clicks on the **Start incident** option, and creates an incident.

**Data collected:**

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

**Action:** `end`

**Triggers:** Any user sends the `/incident end` slash command; Any user clicks on the **End Incident** button through the incident details view, in the RHS.

**Data collected:**

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

## Tasks data

### Actions and data collected

`add_task`, `remove_task`, `rename_task`, `modify_task_state`, `move_task`, `set_assignee_for_task`, `run_task_slash_command`

## Playbook data

### Actions and data collected

`create`, `update`, `delete`
