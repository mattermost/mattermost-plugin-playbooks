// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import moment from 'moment';
import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {UserProfile} from 'mattermost-redux/types/users';

import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import {Incident, incidentCurrentStatus} from 'src/types/incident';
import Duration from 'src/components/duration';
import {navigateToTeamPluginUrl} from 'src/browser_routing';
import {lastUpdatedByIncidentId} from 'src/selectors';
import Profile from 'src/components/profile/profile';
import StatusBadge from 'src/components/backstage/incidents/status_badge';
import {useProfilesInChannel} from 'src/hooks';
import {Checklist, ChecklistItemState} from 'src/types/playbook';
import ProgressBar from 'src/components/backstage/playbooks/incident_list/progress_bar';
import {findLastUpdated, findLastUpdatedWithDefault} from 'src/utils';

const SmallText = styled.div`
    font-weight: 400;
    font-size: 11px;
    line-height: 16px;
    color: var(--center-channel-color-64);
    margin: 5px 0;
`;

const NormalText = styled.div`
    font-weight: 400;
    line-height: 16px;
`;

const SmallProfile = styled(Profile)`
    font-weight: 400;
    font-size: 12px;
    line-height: 16px;

    > .image {
        width: 16px;
        height: 16px;
    }
`;

const SmallStatusBadge = styled(StatusBadge)`
    font-size: 10px;
    line-height: 16px;
    height: 16px;
    padding: 0 4px;
    margin: 0;
`;

const Row = (props: { incident: Incident }) => {
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const profilesInChannel = useProfilesInChannel(props.incident.channel_id);
    const [completedTasks, totalTasks] = tasksCompletedTotal(props.incident.checklists);

    function openIncidentDetails(incident: Incident) {
        navigateToTeamPluginUrl(currentTeam.name, `/incidents/${incident.id}`);
    }

    return (
        <div
            className='row incident-item'
            key={props.incident.id}
            onClick={() => openIncidentDetails(props.incident)}
        >
            <div className='col-sm-4'>
                <TextWithTooltip
                    id={props.incident.id}
                    text={props.incident.name}
                />
            </div>
            <div className='col-sm-2'>
                <SmallStatusBadge
                    status={incidentCurrentStatus(props.incident)}
                />
                <SmallText>
                    <Duration
                        from={findLastUpdatedWithDefault(props.incident)}
                        to={0}
                        ago={true}
                    />
                </SmallText>
            </div>
            <div
                className='col-sm-2'
            >
                <NormalText>
                    <Duration
                        from={props.incident.create_at}
                        to={props.incident.end_at}
                    />
                </NormalText>
                <SmallText>
                    {formatDate(props.incident.create_at)}
                </SmallText>
            </div>
            <div className='col-sm-2'>
                <SmallProfile userId={props.incident.owner_user_id}/>
                <SmallText>{participantsText(profilesInChannel)}</SmallText>
            </div>
            <div className='col-sm-2'>
                <NormalText>{completedTasks + ' / ' + totalTasks}</NormalText>
                <ProgressBar
                    completed={completedTasks}
                    total={totalTasks}
                />
            </div>
        </div>
    );
};

const participantsText = (participants: UserProfile[]) => {
    const num = participants.length - 1;
    const suffix = num === 1 ? '' : 's';
    return num + ' participant' + suffix;
};

const tasksCompletedTotal = (checklists: Checklist[]) => {
    let completed = 0;
    let total = 0;

    for (const cl of checklists) {
        for (const item of cl.items) {
            total++;
            if (item.state === ChecklistItemState.Closed) {
                completed++;
            }
        }
    }

    return [completed, total];
};

const formatDate = (millis: number) => {
    const mom = moment(millis);
    if (mom.isAfter(moment().startOf('d').subtract(2, 'd'))) {
        return mom.calendar();
    }

    if (mom.isSame(moment(), 'year')) {
        return mom.format('MMM DD LT');
    }
    return mom.format('MMM DD YYYY LT');
};

export default Row;
