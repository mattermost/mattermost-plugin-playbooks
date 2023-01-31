// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeam} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/teams';

import {useQuery} from '@apollo/client';

import {RHSContainer, RHSContent} from 'src/components/rhs/rhs_shared';

import {Participants} from 'src/components/backstage/playbook_runs/playbook_run/rhs_participants';
import {Role} from 'src/components/backstage/playbook_runs/shared';

import {graphql} from 'src/graphql/generated';

const rhsRunParticipantsQuery = graphql(/* GraphQL */`
    query RhsRunParticipants($runID: String!) {
        run(id: $runID) {
            participantIDs
            ownerUserID
            ...ParticipantsRun
        }
    }
`);

interface Props {
    runID: string
}

const RHSRunParticipants = (props: Props) => {
    const currentUserId = useSelector(getCurrentUserId);
    const team = useSelector(getCurrentTeam);
    const {data, loading} = useQuery(rhsRunParticipantsQuery, {
        variables: {
            runID: props.runID,
        },
    });

    if (!data || loading || !data.run) {
        return null;
    }

    const role = data.run.participantIDs.includes(currentUserId) || data.run.ownerUserID === currentUserId ? Role.Participant : Role.Viewer;

    return (
        <RHSContainer>
            <RHSContent>
                <Participants
                    playbookRun={data.run}
                    role={role}
                    teamName={team.name}
                />
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSRunParticipants;
