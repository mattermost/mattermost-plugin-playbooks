## Permissions

Incidents and playbooks are associated with teams in Mattermost. Incident channels are created based on playbooks, which define whether an incident channel is public or private. Read more about `public and private channels <https://docs.mattermost.com/help/getting-started/organizing-conversations.html>`_.

Only members of the team in which the playbook or incident is defined have access. Additionally, membership of playbook is independent of membership in incidents:

- Members of a playbook may start an incident using that playbook, or edit the playbook's stages and steps. Non-members do not have access to the playbook at all.
- Members of an incident may modify the current state of the incident, and invite new members to the incident channel.
