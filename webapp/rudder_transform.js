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
