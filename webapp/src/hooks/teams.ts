// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useLocalStorage} from 'react-use';
import {useSelector} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

// Mattermost webapp persists the user's last-active team under
// `user_prev_team:{userId}` in localStorage. We use the same key so the
// Playbooks plugin and the host webapp stay in sync — switching teams in
// either place is reflected in the other on next load.
const prevTeamLocalStorageKey = (userId: string) => `user_prev_team:${userId}`;

/**
 * Returns `[prevTeamId, setPrevTeamId, removePrevTeamId]` for the user's
 * last-active team, persisted to the same localStorage key Mattermost webapp
 * uses. When no previous selection exists, defaults to the first team in the
 * user's `getMyTeams` list — mirroring the host webapp's default-team logic.
 *
 * Use this anywhere the plugin needs a "where should I land the user" team
 * decision (e.g. backstage views without a strong team binding, like
 * teamless DM/GM checklists).
 */
export function usePreviousTeamId() {
    const userId = useSelector(getCurrentUserId);
    const myTeams = useSelector(getMyTeams);
    const fallback = myTeams?.[0]?.id ?? '';

    return useLocalStorage(
        prevTeamLocalStorageKey(userId),
        fallback,
        {raw: true},
    );
}
