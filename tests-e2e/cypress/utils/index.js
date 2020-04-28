// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// import workflowJson from '../fixtures/workflow.json';

// export function getNewWorkflow(team = 'ad-1', channel = 'town-square', users = 'sysadmin, user-1') {
//     const newWorkflow = {...workflowJson};

//     // Make the name and trigger random
//     const randomSuffix = Date.now();
//     newWorkflow.name += randomSuffix;
//     newWorkflow.triggers[0].match += randomSuffix;

//     // Update team, channel and users on Setup step
//     newWorkflow.steps[0].start_actions[0].team_name = team; // CreateWarroom
//     newWorkflow.steps[0].start_actions[1].users = users; // AddUsers
//     newWorkflow.steps[0].start_actions[2].channel_name = channel; // attention_post
//     newWorkflow.steps[0].start_actions[2].team_name = team; // attention_post

//     // Update team and channel on Resolved step
//     newWorkflow.steps[3].start_actions[1].channel_name = channel; // PostResolved
//     newWorkflow.steps[3].start_actions[1].team_name = team; // PostResolved

//     return newWorkflow;
// }

export function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}
