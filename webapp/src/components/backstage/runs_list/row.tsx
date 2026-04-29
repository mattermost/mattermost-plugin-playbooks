// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useUpdateEffect} from 'react-use';
import {DateTime} from 'luxon';
import styled from 'styled-components';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from '@mattermost/types/store';
import {BullhornOutlineIcon} from '@mattermost/compass-icons/components';

import {FormattedMessage, useIntl} from 'react-intl';

import {useAppSelector} from 'src/hooks/redux';

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
import {ToastStyle} from 'src/components/backstage/toast';

const SmallText = styled.div`
    margin: 2px 0 0;
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

const NameCell = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    padding: 0 6px;
    min-width: 0;
`;

const NameRow = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
`;

const RunName = styled.span`
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const FlexCol = styled.div`
    padding: 0 6px;
    min-width: 0;
`;

const StatusCell = styled.div`
    flex: 0 0 150px;
    max-width: 150px;
    padding: 0 6px;
`;

const DurationCell = styled.div`
    flex: 0 0 150px;
    max-width: 150px;
    padding: 0 6px;
`;

const ActionCell = styled.div`
    flex: 0 0 100px;
    max-width: 100px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 8px 0 6px;
`;

const PlaybookRunItem = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    margin: 0;
    background-color: var(--center-channel-bg);
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

interface Props {
    playbookRun: PlaybookRun
    fixedTeam?: boolean
}

const teamNameSelector = (teamId: string) => (state: GlobalState): string => getTeam(state, teamId)?.display_name ?? '';

const Row = (props: Props) => {
    // This is not optimal. One network request for every row.
    const playbookName = usePlaybookName(props.fixedTeam ? '' : props.playbookRun.playbook_id);
    const teamName = useAppSelector(teamNameSelector(props.playbookRun.team_id));

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
            key={props.playbookRun.id}
            data-testid='run-list-item'
            onClick={() => openPlaybookRunDetails(props.playbookRun)}
        >
            <NameCell style={{flex: 4}}>
                <NameRow>
                    {(props.playbookRun.run_number ?? 0) > 0 && props.playbookRun.sequential_id && (
                        <SequentialIdDisplay
                            runNumber={props.playbookRun.run_number ?? 0}
                            sequentialId={props.playbookRun.sequential_id ?? ''}
                        />
                    )}
                    <RunName>{props.playbookRun.name}</RunName>
                </NameRow>
                {infoLine}
            </NameCell>
            <StatusCell>
                <SmallStatusBadge
                    status={BadgeType[props.playbookRun.current_status]}
                />
                <SmallText>
                    {DateTime.fromMillis(findLastUpdatedWithDefault(props.playbookRun)).toRelative()}
                </SmallText>
            </StatusCell>
            <DurationCell>
                <NormalText>
                    <FormattedDuration
                        from={props.playbookRun.create_at}
                        to={props.playbookRun.end_at}
                    />
                </NormalText>
                <SmallText>
                    {formatDate(props.playbookRun.create_at)}
                </SmallText>
            </DurationCell>
            <FlexCol style={{flex: 2}}>
                <SmallProfile userId={props.playbookRun.owner_user_id}/>
                <SmallText>
                    <FormattedMessage
                        defaultMessage='{numParticipants, plural, =0 {no participants} =1 {# participant} other {# participants}}'
                        values={{numParticipants: props.playbookRun.participant_ids.length}}
                    />
                </SmallText>
            </FlexCol>
            <ActionCell>
                <FollowPlaybookRun id={props.playbookRun.id}/>
            </ActionCell>
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
    const currentUser = useAppSelector(getCurrentUser);
    const [metadata] = useRunMetadata(id);
    const [followers, setFollowers] = useState(metadata?.followers || []);
    const [isFollowing, setIsFollowing] = useState(followers.includes(currentUser.id));
    const addToast = useToaster().add;

    useUpdateEffect(() => {
        const newFollowers = metadata?.followers || [];
        setFollowers(newFollowers);
        setIsFollowing(newFollowers.includes(currentUser.id));
    }, [currentUser.id, JSON.stringify(metadata?.followers)]);

    const toggleFollow = () => {
        const action = isFollowing ? unfollowPlaybookRun : followPlaybookRun;
        action(id)
            .then(() => {
                const newFollowers = isFollowing ? followers.filter((userId) => userId !== currentUser.id) : [...followers, currentUser.id];
                setIsFollowing(!isFollowing);
                setFollowers(newFollowers);
            })
            .catch(() => {
                setIsFollowing(isFollowing);
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
