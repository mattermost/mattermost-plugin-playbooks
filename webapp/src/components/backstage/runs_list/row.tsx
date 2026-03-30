// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {useUpdateEffect} from 'react-use';
import {DateTime} from 'luxon';
import styled from 'styled-components';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from '@mattermost/types/store';
import {BullhornOutlineIcon} from '@mattermost/compass-icons/components';
import {useSelector} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';

import {PlaybookRun} from 'src/types/playbook_run';
import FormattedDuration from 'src/components/formatted_duration';
import {navigateToPluginUrl} from 'src/browser_routing';
import Profile from 'src/components/profile/profile';
import StatusBadge, {BadgeType} from 'src/components/backstage/status_badge';
import {SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {findLastUpdatedWithDefault} from 'src/utils';
import {usePlaybookName, useRunMetadata} from 'src/hooks';
import {followPlaybookRun, unfollowPlaybookRun} from 'src/client';

import {InfoLine} from 'src/components/backstage/styles';
import {useToaster} from 'src/components/backstage/toast_banner';
import SequentialIdDisplay from 'src/components/backstage/runs_list/sequential_id_display';
import TaskProgress from 'src/components/backstage/runs_list/task_progress';
import AttributeColumns from 'src/components/backstage/runs_list/attribute_columns';
import {ToastStyle} from 'src/components/backstage/toast';

const SmallText = styled.div`
    margin: 5px 0;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 11px;
    font-weight: 400;
    line-height: 16px;
`;

const NormalText = styled.div`
    font-weight: 400;
    line-height: 16px;
`;

const SmallProfile = styled(Profile)`
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;

    > .image {
        width: 16px;
        height: 16px;
    }
`;

const SmallStatusBadge = styled(StatusBadge)`
    height: 16px;
    padding: 0 4px;
    margin: 0;
    font-size: 10px;
    line-height: 16px;
`;

const RunName = styled.div`
    font-size: 14px;
    font-weight: 600;
    line-height: 16px;
`;

const PlaybookRunItem = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding-top: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    margin: 0;
    background-color: var(--center-channel-bg);
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

const AttributeColumnsRow = styled.div`
    width: 100%;
    padding: 4px 0 4px 15px;
`;

interface Props {
    playbookRun: PlaybookRun
    fixedTeam?: boolean
    selectedFieldIds?: string[]
}

const teamNameSelector = (teamId: string) => (state: GlobalState): string => getTeam(state, teamId)?.display_name ?? '';

const Row = (props: Props) => {
    // This is not optimal. One network request for every row.
    const playbookName = usePlaybookName(props.fixedTeam ? '' : props.playbookRun.playbook_id);
    const teamName = useSelector(teamNameSelector(props.playbookRun.team_id));

    let infoLine: React.ReactNode = null;
    if (!props.fixedTeam) {
        infoLine = (
            <InfoLine>
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {playbookName ? teamName + ' • ' + playbookName : teamName}
            </InfoLine>
        );
    }

    function openPlaybookRunDetails(playbookRun: PlaybookRun) {
        navigateToPluginUrl(`/runs/${playbookRun.id}?from=run_list`);
    }

    return (
        <PlaybookRunItem
            className='row'
            key={props.playbookRun.id}
            data-testid='run-list-item'
            onClick={() => openPlaybookRunDetails(props.playbookRun)}
        >
            <div className='col-sm-4'>
                <RunName>
                    <SequentialIdDisplay
                        runNumber={props.playbookRun.run_number ?? 0}
                        sequentialId={props.playbookRun.sequential_id ?? ''}
                        runName={props.playbookRun.name}
                    />
                </RunName>
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
                <TaskProgress
                    taskTotal={props.playbookRun.task_total}
                    taskCompleted={props.playbookRun.task_completed}
                />
            </div>
            <div className='col-sm-2'>
                <FollowPlaybookRun id={props.playbookRun.id}/>
            </div>
            {props.playbookRun.property_fields && props.playbookRun.property_fields.length > 0 && (
                <AttributeColumnsRow>
                    <AttributeColumns
                        propertyFields={props.playbookRun.property_fields}
                        propertyValues={props.playbookRun.property_values}
                        selectedFieldIds={props.selectedFieldIds}
                    />
                </AttributeColumnsRow>
            )}
        </PlaybookRunItem>
    );
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

// TODO: this should converge with src/hooks/run : useFollowRun
const FollowPlaybookRun = ({id}: {id: string}) => {
    const {formatMessage} = useIntl();
    const currentUser = useSelector(getCurrentUser);
    const [metadata] = useRunMetadata(id);
    const [followers, setFollowers] = useState(metadata?.followers || []);
    const [isFollowing, setIsFollowing] = useState(followers.includes(currentUser.id));
    const [isToggling, setIsToggling] = useState(false);
    const addToast = useToaster().add;
    const isMountedRef = useRef(true);
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useUpdateEffect(() => {
        const newFollowers = metadata?.followers || [];
        setFollowers(newFollowers);
        setIsFollowing(newFollowers.includes(currentUser.id));
    }, [currentUser.id, JSON.stringify(metadata?.followers)]);

    const toggleFollow = () => {
        if (isToggling) {
            return;
        }
        setIsToggling(true);
        const action = isFollowing ? unfollowPlaybookRun : followPlaybookRun;
        action(id)
            .then(() => {
                if (!isMountedRef.current) {
                    return;
                }
                const newFollowers = isFollowing ? followers.filter((userId) => userId !== currentUser.id) : [...followers, currentUser.id];
                setIsFollowing(!isFollowing);
                setFollowers(newFollowers);
                setIsToggling(false);
            })
            .catch(() => {
                if (!isMountedRef.current) {
                    return;
                }
                setIsFollowing(isFollowing);
                setIsToggling(false);
                addToast({
                    content: formatMessage({defaultMessage: 'It was not possible to {isFollowing, select, true {unfollow} other {follow}} the run'}, {isFollowing}),
                    toastStyle: ToastStyle.Failure,
                });
            });
    };

    if (isFollowing) {
        return (
            <FollowingButton
                onClick={(e) => {
                    e.stopPropagation();
                    toggleFollow();
                }}
                data-testid='unfollow-playbook'
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '32px',
                    padding: '0 18px',
                }}
            >
                {formatMessage({defaultMessage: 'Following'})}
            </FollowingButton>
        );
    }

    return (
        <FollowButton
            onClick={(e) => {
                e.stopPropagation();
                toggleFollow();
            }}
            data-testid='follow-playbook'
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                height: '32px',
                padding: '0 16px',
            }}
        >
            <BullhornOutlineIcon size={16}/>
            {formatMessage({defaultMessage: 'Follow'})}
        </FollowButton>
    );
};

const FollowButton = styled(SecondaryButton)`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const FollowingButton = styled(TertiaryButton)`
    color: var(--button-bg);
`;
