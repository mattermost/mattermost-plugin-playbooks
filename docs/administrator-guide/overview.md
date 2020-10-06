# Overview

Incident Response is a Mattermost plugin designed to help organizations monitor, coordinate, and measure their incident response processes, increasing transparency, maximizing effectiveness, and ultimately saving costs by cutting down time taken to respond and resolve incidents.

Incidents are situations which require an immediate response and benefit from a clearly defined process guiding towards resolution. A playbook defines this process, initializing a dedicated channel for the incident with steps grouped into stages for members of the incident to follow. When the situation is resolved, the incident is ended, and the playbook can be updated to improve the response to similar incidents in the future.

Playbooks and incidents are scoped by teams, and cannot be shared between teams.

## Permissions

Incidents and playbooks are associated with teams in Mattermost. Incident channels are created based on playbooks, which define whether an incident channel is public or private. Read more about `public and private channels <https://docs.mattermost.com/help/getting-started/organizing-conversations.html>`_.

Only members of the team in which the playbook or incident is defined have access. Additionally, membership of playbook is independent of membership in incidents:

- Members of a playbook may start an incident using that playbook, or edit the playbook's stages and steps. Non-members do not have access to the playbook at all.
- Members of an incident may modify the current state of the incident, and invite new members to the incident channel.

## Glossary

* **Incident:** An event requiring the coordinated actions of one or more Mattermost users. An incident is either ongoing or closed.
* **Playbook:** A set of steps to execute as part of resolving an incident. It consists of one or more checklists, with each checklist item representing a single step.
* **Commander:** The Mattermost user currently responsible for transitioning an incident from ongoing to closed.
* **Incident channel:** A Mattermost channel dedicated to real-time conversation about the incident.
* **Incident participant:** A Mattermost user with access to the corresponding incident channel.
* **The RHS:** The incident list and incident details displayed on the right hand side of the webapp. Clicking an incident from the list in the RHS surfaces details of the selected incident. It is not available on mobile.
* **Incident backstage:** The full-screen analytics and configuration screens accessible from the webapp. It is not available on mobile.
* **Active incident:** An incident that has not been ended.
