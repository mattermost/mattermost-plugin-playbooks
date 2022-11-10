// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeam} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/teams';

import {
    RHSContainer,
    RHSContent,
} from 'src/components/rhs/rhs_shared';
import {currentPlaybookRun} from 'src/selectors';
import {usePlaybookRunViewTelemetry} from 'src/hooks/telemetry';
import {PlaybookRunViewTarget} from 'src/types/telemetry';
import {Participants} from '../backstage/playbook_runs/playbook_run/rhs_participants';
import {Role} from '../backstage/playbook_runs/shared';

const RHSRunParticipants = () => {
    const currentUserId = useSelector(getCurrentUserId);

    const playbookRun = useSelector(currentPlaybookRun);
    const team = useSelector(getCurrentTeam);
    usePlaybookRunViewTelemetry(PlaybookRunViewTarget.ChannelsRHSDetails, playbookRun?.id);

    if (!playbookRun) {
        return null;
    }

    const role = playbookRun?.participant_ids.includes(currentUserId) || playbookRun?.owner_user_id === currentUserId ? Role.Participant : Role.Viewer;

    return (
        <RHSContainer>
            <RHSContent>
                <Participants
                    playbookRun={playbookRun}
                    role={role}
                    teamName={team.name}
                />
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSRunParticipants;
