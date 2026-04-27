// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {General} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {GlobalState} from '@mattermost/types/store';

import {PlaybookRun} from 'src/types/playbook_run';

// DM/GM checklist runs are intentionally teamless, so an empty `team_id`
// is the primary signal. We refine with the linked channel's type when
// it's available in the redux store, which catches any legacy or future
// run that happens to reference a DM/GM channel without our teamless
// invariant. No network call is issued — if the channel hasn't been
// hydrated yet, the team_id check alone keeps the answer correct on
// cold loads.
export function useIsDMGM(run: PlaybookRun | null | undefined): boolean {
    const channel = useSelector((state: GlobalState) => (
        run?.channel_id ? getChannel(state, run.channel_id) : undefined
    ));

    if (!run) {
        return false;
    }
    if (!run.team_id) {
        return true;
    }
    return channel?.type === General.DM_CHANNEL || channel?.type === General.GM_CHANNEL;
}
