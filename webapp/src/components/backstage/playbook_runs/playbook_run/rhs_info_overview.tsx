// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {Channel} from '@mattermost/types/channels';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {General} from 'mattermost-redux/constants';

import {
    AccountMultipleOutlineIcon,
    AccountOutlineIcon,
    ArrowForwardIosIcon,
    BookOutlineIcon,
    BullhornOutlineIcon,
    LockOutlineIcon,
    OpenInNewIcon,
    ProductChannelsIcon,
} from '@mattermost/compass-icons/components';
import {UserProfile} from '@mattermost/types/users';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {TertiaryButton} from 'src/components/assets/buttons';
import FollowButton from 'src/components/backstage/follow_button';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import Following from 'src/components/backstage/playbook_runs/playbook_run/following';
import AssignTo from 'src/components/checklist_item/assign_to';
import {UserList} from 'src/components/rhs/rhs_participants';
import {Section, SectionHeader} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_styles';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {setOwner as clientSetOwner, requestJoinChannel} from 'src/client';
import {pluginUrl} from 'src/browser_routing';
import {Metadata, PlaybookRun} from 'src/types/playbook_run';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {CompassIcon} from 'src/types/compass';

import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';
import {useEnsureProfiles, useTextOverflow} from 'src/hooks';
import Tooltip from 'src/components/widgets/tooltip';

import {FollowState} from './rhs_info';

const useRequestJoinChannel = (playbookRunId: string) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const [showRequestJoinConfirm, setShowRequestJoinConfirm] = useState(false);
    const requestJoin = async () => {
        const response = await requestJoinChannel(playbookRunId);
        if (response?.error) {
            addToast({
                content: formatMessage({defaultMessage: 'The join channel request was unsuccessful.'}),
                toastStyle: ToastStyle.Failure,
            });
        } else {
            addToast({
                content: formatMessage({defaultMessage: 'Your request was sent to the run channel.'}),
                toastStyle: ToastStyle.Success,
            });
        }
    };
    const RequestJoinModal = (
        <ConfirmModal
            show={showRequestJoinConfirm}
            title={formatMessage({defaultMessage: 'Request to join channel'})}
            message={formatMessage({defaultMessage: 'A join request will be sent to the run channel.'})}
            confirmButtonText={formatMessage({defaultMessage: 'Send request '})}
            onConfirm={() => {
                requestJoin();
                setShowRequestJoinConfirm(false);
            }}
            onCancel={() => setShowRequestJoinConfirm(false)}
        />
    );
    return {
        RequestJoinModal,
        showRequestJoinConfirm: () => setShowRequestJoinConfirm(true),
    };
};

interface Props {
    run: PlaybookRun;
    runMetadata?: Metadata;
    editable: boolean;
    channel: Channel | undefined | null;
    channelDeleted: boolean;
    followState: FollowState;
    playbook?: PlaybookWithChecklist;
    role: Role;
    onViewParticipants: () => void;
}

const StyledArrowIcon = styled(ArrowForwardIosIcon)`
    margin-left: 7px;
`;

const RHSInfoOverview = ({run, role, channel, channelDeleted, runMetadata, followState, editable, playbook, onViewParticipants}: Props) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const refreshLHS = useLHSRefresh();
    const {RequestJoinModal, showRequestJoinConfirm} = useRequestJoinChannel(run.id);

    const setOwner = async (userID: string) => {
        try {
            const response = await clientSetOwner(run.id, userID);

            if (response.error) {
                let message;
                switch (response.error.status_code) {
                case 403:
                    message = formatMessage({defaultMessage: 'You have no permissions to change the owner'});
                    break;
                default:
                    message = formatMessage({defaultMessage: 'It was not possible to change the owner'});
                }

                addToast({
                    content: message,
                    toastStyle: ToastStyle.Failure,
                });
            } else {
                refreshLHS();
            }
        } catch {
            addToast({
                content: formatMessage({defaultMessage: 'It was not possible to change the owner'}),
                toastStyle: ToastStyle.Failure,
            });
        }
    };

    const onOwnerChange = async (user?: UserProfile) => {
        if (!user) {
            return;
        }
        setOwner(user.id);
    };

    return (
        <Section>
            <SectionHeader title={formatMessage({defaultMessage: 'Overview'})}/>
            {run.playbook_id && playbook && (
                <Item
                    id='runinfo-playbook'
                    icon={BookOutlineIcon}
                    name={formatMessage({defaultMessage: 'Playbook'})}
                >
                    <ItemLink to={pluginUrl(`/playbooks/${run.playbook_id}`)}>{playbook.title}</ItemLink>
                </Item>
            )}
            <Item
                id='runinfo-owner'
                icon={AccountOutlineIcon}
                name={formatMessage({defaultMessage: 'Owner'})}
            >
                <AssignTo
                    assignee_id={run.owner_user_id}
                    editable={editable}
                    onSelectedChange={onOwnerChange}
                    participantUserIds={run.participant_ids}
                    placement={'bottom-end'}
                    teamId={run.team_id}
                    channelId={run.channel_id}
                />
            </Item>
            <Item
                id='runinfo-participants'
                icon={AccountMultipleOutlineIcon}
                name={formatMessage({defaultMessage: 'Participants'})}
                onClick={onViewParticipants}
            >
                <ParticipantsContainer>
                    <Participants>
                        <UserList
                            userIds={run.participant_ids}
                            sizeInPx={20}
                        />
                    </Participants>
                    <StyledArrowIcon
                        size={12}
                        color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                    />
                </ParticipantsContainer>
            </Item>
            <Item
                id='runinfo-following'
                icon={BullhornOutlineIcon}
                name={formatMessage({defaultMessage: 'Followers'})}
            >
                <FollowersWrapper>
                    <FollowButton
                        runID={run.id}
                        followState={followState}
                    />
                    <Following
                        userIds={followState.followers}
                        maxUsers={4}
                    />
                </FollowersWrapper>
            </Item>
            <Item
                id='runinfo-channel'
                icon={ProductChannelsIcon}
                name={formatMessage({defaultMessage: 'Channel'})}
            >
                <ChannelRow
                    channel={channel}
                    runMetadata={runMetadata}
                    channelDeleted={channelDeleted}
                    role={role}
                    onClickRequestJoin={showRequestJoinConfirm}
                />
            </Item>
            {RequestJoinModal}
        </Section>
    );
};

export default RHSInfoOverview;

interface ItemProps {
    id: string;
    icon: CompassIcon;
    name: string;
    children: React.ReactNode;
    onClick?: () => void;
}

const Item = (props: ItemProps) => {
    const Icon = props.icon;

    return (
        <OverviewRow
            onClick={props.onClick}
            data-testid={props.id}
        >
            <OverviewItemName>
                <Icon
                    size={18}
                    color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                />
                {props.name}
            </OverviewItemName>
            {props.children}
        </OverviewRow>
    );
};

interface ChannelRowProps {
    channel: Channel | undefined | null;
    channelDeleted: boolean;
    runMetadata?: Metadata;
    role: Role;
    onClickRequestJoin: () => void;
}

const ChannelRow = ({channel, runMetadata, channelDeleted, role, onClickRequestJoin}: ChannelRowProps) => {
    const {formatMessage} = useIntl();
    const currentTeam = useSelector(getCurrentTeam);
    const channelNameRef = useRef<HTMLSpanElement>(null);
    const isChannelNameOverflowing = useTextOverflow(channelNameRef);

    // DM channel display name comes from the teammate's profile, not from the
    // channel itself — `Channel.name` for a DM is the user-id pair (e.g.
    // "{userIdA}__{userIdB}") and `display_name` is blank in the store. Derive
    // the teammate id from the channel name and look up the user directly.
    const currentUserId = useSelector(getCurrentUserId);
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);
    const teammateId = (channel && channel.type === General.DM_CHANNEL) ? getUserIdFromChannelName(currentUserId, channel.name) : '';
    const teammate = useSelector((state: GlobalState) => (
        teammateId ? getUser(state, teammateId) : null
    ));

    // On a fresh page load (e.g. refresh on the backstage detail of a DM-linked
    // checklist) the teammate user may not be in the redux store yet — without
    // them we can't compute the DM display name. Pull the user into store so
    // the next render has it.
    useEnsureProfiles(teammateId ? [teammateId] : []);

    if (channelDeleted) {
        return (
            <ItemDisabledContent>
                {formatMessage({defaultMessage: 'Channel deleted'})}
            </ItemDisabledContent>
        );
    }

    if (channel && runMetadata) {
        // Use current team as fallback when run's team_name is empty (DM/GM runs)
        const teamName = runMetadata.team_name || currentTeam?.name || '';

        // For DMs, the visible label is the teammate's display name; the
        // channel itself has no human-readable name. For GMs and regular
        // channels, fall back to the channel's display_name (Mattermost
        // populates this for GMs from member profiles when those load).
        let displayName: string;
        if (channel.type === General.DM_CHANNEL && teammate) {
            displayName = displayUsername(teammate, teammateNameDisplay) || teammate.username;
        } else {
            displayName = channel.display_name;
        }

        // Build the full URL path. DM/GM channels are teamless on the model
        // but the Mattermost frontend route grammar still requires a team
        // prefix; fall back to currentTeam.name (already encoded in teamName)
        // so the link actually navigates.
        let channelPath: string;
        if (channel.type === General.DM_CHANNEL) {
            channelPath = teammate ?
                `/${teamName}/messages/@${teammate.username}` :
                `/${teamName}/messages/${channel.name}`;
        } else if (channel.type === General.GM_CHANNEL) {
            channelPath = `/${teamName}/messages/${channel.name}`;
        } else {
            channelPath = `/${teamName}/channels/${channel.name}`;
        }

        const linkContent = (
            <ItemLink
                to={channelPath}
                data-testid='runinfo-channel-link'
            >
                <ItemContent ref={channelNameRef}>
                    {displayName}
                </ItemContent>
                <OpenInNewIcon
                    size={14}
                    color={'var(--button-bg)'}
                />
            </ItemLink>
        );

        if (isChannelNameOverflowing) {
            return (
                <Tooltip
                    id={`channel-name-tooltip-${channel.id}`}
                    content={displayName}
                >
                    {linkContent}
                </Tooltip>
            );
        }

        return linkContent;
    }

    return (
        <ItemDisabledContent>
            {role === Role.Participant ? <RequestJoinButton onClick={onClickRequestJoin}>{formatMessage({defaultMessage: 'Request to Join'})}</RequestJoinButton> : null}
            <LockOutlineIcon size={20}/> {formatMessage({defaultMessage: 'Private'})}
        </ItemDisabledContent>
    );
};

const ItemLink = styled(Link)`
    display: flex;
    flex-direction: row;
    align-items: center;

    svg {
        margin-left: 3px;
    }
`;

const ItemContent = styled.span`
    overflow: hidden;
    max-width: 230px;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const ItemDisabledContent = styled(ItemContent)`
    svg {
        margin-right: 3px;
    }

    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const OverviewItemName = styled.div`
    display: flex;
    align-items: center;
    gap: 11px;
`;

const Participants = styled.div`
    display: flex;
    flex-direction: row;
`;

const FollowersWrapper = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;

const RequestJoinButton = styled(TertiaryButton)`
    height: 24px;
    padding: 0 10px;
    margin-right: 10px;
    font-size: 12px;
`;

const ParticipantsContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;

const OverviewRow = styled.div<{ onClick?: () => void }>`
    padding: 10px 24px;
    height: 44px;
    display: flex;
    justify-content: space-between;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    ${({onClick}) => onClick && css`
        cursor: pointer;
    `};
`;
