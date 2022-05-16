// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DateTime} from 'luxon';
import styled from 'styled-components';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {GlobalState} from 'mattermost-redux/types/store';

import {useSelector} from 'react-redux';

import {FormattedMessage} from 'react-intl';

import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import {PlaybookRun} from 'src/types/playbook_run';
import FormattedDuration from 'src/components/formatted_duration';
import {navigateToPluginUrl} from 'src/browser_routing';
import Profile from 'src/components/profile/profile';
import StatusBadge, {BadgeType} from 'src/components/backstage/status_badge';
import {Checklist, ChecklistItemState} from 'src/types/playbook';

import {findLastUpdatedWithDefault} from 'src/utils';
import {usePlaybookName} from 'src/hooks';

import {InfoLine} from '../styles';

import ProgressBar from './progress_bar';

const SmallText = styled.div`
    font-weight: 400;
    font-size: 11px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
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

const RunName = styled.div`
    font-weight: 600;
    font-size: 14px;
    line-height: 16px;
`;

const PlaybookRunItem = styled.div`
    display: flex;
    padding-top: 8px;
    padding-bottom: 8px;
    align-items: center;
    margin: 0;
    background-color: var(--center-channel-bg);
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

interface Props {
    playbookRun: PlaybookRun
    fixedTeam?: boolean
}

const teamNameSelector = (teamId: string) => (state: GlobalState): string => getTeam(state, teamId).display_name;

const Row = (props: Props) => {
    // This is not optimal. One network request for every row.
    const playbookName = usePlaybookName(props.fixedTeam ? '' : props.playbookRun.playbook_id);
    const teamName = useSelector(teamNameSelector(props.playbookRun.team_id));
    const [completedTasks, totalTasks] = tasksCompletedTotal(props.playbookRun.checklists);

    let infoLine: React.ReactNode = null;
    if (!props.fixedTeam) {
        infoLine = <InfoLine>{playbookName ? teamName + ' • ' + playbookName : teamName}</InfoLine>;
    }

    function openPlaybookRunDetails(playbookRun: PlaybookRun) {
        navigateToPluginUrl(`/runs/${playbookRun.id}`);
    }

    return (
        <PlaybookRunItem
            className='row'
            key={props.playbookRun.id}
            onClick={() => openPlaybookRunDetails(props.playbookRun)}
        >
            <div className='col-sm-4'>
                <RunName>{props.playbookRun.name}</RunName>
                {infoLine}
            </div>
            <div className='col-sm-2'>
                <SmallStatusBadge
                    status={BadgeType[props.playbookRun.current_status]}
                />
                <SmallText>
                    {DateTime.fromMillis(findLastUpdatedWithDefault(props.playbookRun)).toRelative()}
                </SmallText>
            </div>
            <div
                className='col-sm-2'
            >
                <NormalText>
                    <FormattedDuration
                        from={props.playbookRun.create_at}
                        to={props.playbookRun.end_at}
                    />
                </NormalText>
                <SmallText>
                    {formatDate(props.playbookRun.create_at)}
                </SmallText>
            </div>
            <div className='col-sm-2'>
                <SmallProfile userId={props.playbookRun.owner_user_id}/>
                <SmallText>
                    <FormattedMessage
                        defaultMessage='{numParticipants, plural, =0 {no participants} =1 {# participant} other {# participants}}'
                        values={{numParticipants: props.playbookRun.participant_ids.length}}
                    />
                </SmallText>
            </div>
            <div className='col-sm-2'>
                <NormalText>{completedTasks + ' / ' + totalTasks}</NormalText>
                <ProgressBar
                    completed={completedTasks}
                    total={totalTasks}
                />
            </div>
        </PlaybookRunItem>
    );
};

const tasksCompletedTotal = (checklists: Checklist[]) => {
    let completed = 0;
    let total = 0;

    for (const cl of checklists) {
        for (const item of cl.items) {
            if (item.state !== ChecklistItemState.Skip) {
                total++;
            }
            if (item.state === ChecklistItemState.Closed) {
                completed++;
            }
        }
    }
    return [completed, total];
};

const formatDate = (millis: number) => {
    const dt = DateTime.fromMillis(millis);
    if (dt > DateTime.now().startOf('day').minus({days: 2})) {
        return dt.toRelativeCalendar();
    }

    if (dt.hasSame(DateTime.now(), 'year')) {
        return dt.toFormat('LLL dd t');
    }
    return dt.toFormat('LLL dd yyyy t');
};

export default Row;
