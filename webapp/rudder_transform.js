// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Note that This file is not used from webapp's build
//
// It's the transformer function that ruddersack should have to transform the
// old event data into the new event data.

// eslint-disable-next-line no-unused-vars
export function transformEvent(event, metadata) {
    const action = event.properties.Action;

    if (action === undefined) {
        return event;
    }

    switch (event.event) {
    // eslint-disable-next-line lines-around-comment
    // Rename events
    case 'playbookrun_get_involved_join':
        event.event = 'playbookrun_participate';
        break;
    case 'playbookrun_request_update_click':
        event.event = 'playbookrun_request_update';
        break;
    case 'playbookrun_action':
        switch (action) {
        case 'update_playbookrun_actions':
            event.event = 'playbookrun_update_actions';
            delete event.properties.Action;
            break;
        }
        break;

    // Convert old frontend events
    case 'frontend':
        switch (action) {
        case 'view_run_details':
            event.type = 'page';
            event.event = 'run_details';
            delete event.properties.Action;
            break;

            // ... other actions for frontend event
        }

        // ... other events
        break;
    }
    return event;
}
