# Slash Commands

Slash commands are shortcuts used to perform actions in Mattermost. To view the available slash commands in Mattermost begin by typing / and a list of slash command options appears above the text input box. The autocomplete suggestions help by providing a format example in black text and a short description of the slash command in grey text.

## Using slash commands

The Incident Response plugin includes built-in slash commands:

- `/incident start` - Start a new incident.
- `/incident end` - Close the incident of that channel.
- `/incident restart` - Restart a closed incident.
- `/incident check [checklist #] [item #]` - Check/uncheck the checklist item.
- `/incident announce ~[channels]` - Announce the current incident in other channels.
- `/incident list` - List all your incidents.
- `/incident commander [@username]` - Show or change the current commander.
- `/incident info` - Show a summary of the current incident.
- `/incident stage [next/prev]` - Move to the next or previous stage.

## Adding slash commands to tasks

Slash commands can be added to tasks to initiate actions as part of the incident response. 

Here are some examples:

- Add a task called **Sync up** with the slash command `/jitsi hello`. Running that slash command initiates a Jitsi call in the incident channel.
- One of your tasks may require the header to be changed to reflect a new status. Create a task called **Change header** with the slash command `/header new header`.
