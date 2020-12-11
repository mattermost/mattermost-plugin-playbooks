## What are slash commands?

Slash commands are shortcuts used to perform actions in Mattermost. To view the available slash commands in Mattermost begin by typing `/` and a list of slash command options appears above the text input box. The autocomplete suggestions help by providing a format example in black text and a short description of the slash command in grey text.

## Using slash commands

Mattermost Incident Management includes built-in slash commands:

- `/incident start` - Start a new incident.
- `/incident end` - Close the incident of that channel.
- `/incident restart` - Restart a closed incident.
- `/incident check [checklist #] [item #]` - Check/uncheck the checklist item.
- `/incident announce ~[channels]` - Announce the current incident in other channels.
- `/incident list` - List all your incidents.
- `/incident commander [@username]` - Show or change the current commander.
- `/incident info` - Show a summary of the current incident.
- `/incident stage [next/prev]` - Move to the next or previous stage.

## Generating test data

You can use the test commands to create incidents that are populated with random data. These incidents are listed in the incident insight page.

- `/incident test create-incident`: This command accepts a playbook ID (that can be chosen from the playbooks the user is a member of, using the autocomplete system), a timestamp, and an incident name. It creates an ongoing incident with the creation date set to the specified timestamp. An example command looks like this: `/incident test create-incident 6utgh6qg7p8ndeef9edc583cpc 2020-11-23 PR-Testing`.

- `/incident test bulk-data`: This command accepts a number of ongoing incidents, a number of ended incidents, a beginning and an end date, and an optional seed. It creates as many ongoing and ended incidents as specified, all of them with their creation date randomly picked between the beginning and end dates. The seed, if available, is used to get reproducible results. The names of the incidents are randomly chosen from a list of incident names and a list of fake company names which are defined in the code. An example command is: `/incident test bulk-data 10 3 2020-01-31 2020-11-22 2`.

## Adding slash commands to tasks

Slash commands can be added to tasks to initiate actions as part of your incident response playbook.

Here are some examples:

- Add a communication task called **Sync up** with the slash command `/zoom hello`. Running that slash command initiates a Zoom call in the incident channel. If you've installed Jitsi, you could use `/jitsi hello`. 

![Tasks and slash commands](../assets/stage_task_slashcommand.png)

- One of your tasks may require the channel header to be changed to reflect a new status. Create a task called **Change header** with the slash command `/header new header`.

![Tasks and slash commands](../assets/stage_task_header.png)
