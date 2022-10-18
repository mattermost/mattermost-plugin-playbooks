// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import {Link} from 'react-router-dom';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';
import {Channel} from '@mattermost/types/channels';

import {
    AccountOutlineIcon,
    AccountMultipleOutlineIcon,
    BookOutlineIcon,
    BullhornOutlineIcon,
    ProductChannelsIcon,
    OpenInNewIcon,
    LockOutlineIcon,
    ArrowForwardIosIcon,
} from '@mattermost/compass-icons/components';
import {addChannelMember} from 'mattermost-redux/actions/channels';
import {UserProfile} from '@mattermost/types/users';

import {TertiaryButton} from 'src/components/assets/buttons';
import {useToaster, ToastType} from 'src/components/backstage/toast_banner';
import FollowButton from 'src/components/backstage/follow_button';
import Following from 'src/components/backstage/playbook_runs/playbook_run/following';
import AssignTo, {AssignToContainer} from 'src/components/checklist_item/assign_to';
import {UserList} from 'src/components/rhs/rhs_participants';
import {Section, SectionHeader} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_styles';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {requestJoinChannel, setOwner as clientSetOwner} from 'src/client';
import {pluginUrl} from 'src/browser_routing';
import {useFormattedUsername} from 'src/hooks';
import {PlaybookRun, Metadata} from 'src/types/playbook_run';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {CompassIcon} from 'src/types/compass';

import {useLHSRefresh} from '../../lhs_navigation';

import {FollowState} from './rhs_info';

const useRequestJoinChannel = (playbookRunId: string) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const [showRequestJoinConfirm, setShowRequestJoinConfirm] = useState(false);
    const requestJoin = async () => {
        const response = await requestJoinChannel(playbookRunId);
        if (response?.error) {
            addToast(formatMessage({defaultMessage: 'The join channel request was unsuccessful.'}), ToastType.Failure);
        } else {
            addToast(formatMessage({defaultMessage: 'Your request was sent to the run channel.'}), ToastType.Success);
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
    followState: FollowState;
    playbook?: PlaybookWithChecklist;
    role: Role;
    onViewParticipants: () => void;
}

const StyledArrowIcon = styled(ArrowForwardIosIcon)`
    margin-left: 7px;
`;

const RHSInfoOverview = ({run, role, channel, runMetadata, followState, editable, playbook, onViewParticipants}: Props) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const [showAddToChannel, setShowAddToChannel] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
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

                addToast(message, ToastType.Failure);
            } else {
                refreshLHS();
            }
        } catch (error) {
            addToast(formatMessage({defaultMessage: 'It was not possible to change the owner'}), ToastType.Failure);
        }
    };

    const onOwnerChange = async (userType?: string, user?: UserProfile) => {
        if (!user || !userType) {
            return;
        }

        if (userType === 'Member') {
            setOwner(user.id);
        } else {
            setSelectedUser(user);
            setShowAddToChannel(true);
        }
    };

    return (
        <Section>
            <SectionHeader title={formatMessage({defaultMessage: 'Overview'})}/>
            <Item
                id='runinfo-playbook'
                icon={BookOutlineIcon}
                name={formatMessage({defaultMessage: 'Playbook'})}
            >
                {playbook ? <ItemLink to={pluginUrl(`/playbooks/${run.playbook_id}`)}>{playbook.title}</ItemLink> : <ItemDisabledContent><LockOutlineIcon size={18}/>{formatMessage({defaultMessage: 'Private'})}</ItemDisabledContent>}
            </Item>
            <Item
                id='runinfo-owner'
                icon={AccountOutlineIcon}
                name={formatMessage({defaultMessage: 'Owner'})}
            >
                <AssignTo
                    assignee_id={run.owner_user_id}
                    editable={editable}
                    onSelectedChange={onOwnerChange}
                    channelId={run.channel_id}
                    placement={'bottom-end'}
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
                        trigger={'run_details'}
                    />
                    <Following
                        userIds={followState.followers}
                        maxUsers={4}
                    />
                </FollowersWrapper>
            </Item>
            {selectedUser &&
            <AddToChannelModal
                user={selectedUser}
                channelId={run.channel_id}
                setOwner={setOwner}
                show={showAddToChannel}
                onHide={() => {
                    setShowAddToChannel(false);
                    setSelectedUser(null);
                }}
            />}
            <Item
                id='runinfo-channel'
                icon={ProductChannelsIcon}
                name={formatMessage({defaultMessage: 'Channel'})}
            >
                {channel && runMetadata ? <>
                    <ItemLink
                        to={`/${runMetadata.team_name}/channels/${channel.name}`}
                        data-testid='runinfo-channel-link'
                    >
                        <ItemContent >
                            {channel.display_name}
                        </ItemContent>
                        <OpenInNewIcon
                            size={14}
                            color={'var(--button-bg)'}
                        />
                    </ItemLink>
                </> : <ItemDisabledContent>
                    {role === Role.Participant ? <RequestJoinButton onClick={showRequestJoinConfirm}>{formatMessage({defaultMessage: 'Request to Join'})}</RequestJoinButton> : null}
                    <LockOutlineIcon size={20}/> {formatMessage({defaultMessage: 'Private'})}
                </ItemDisabledContent>
                }
            </Item>
            {RequestJoinModal}
        </Section>
    );
};

export default RHSInfoOverview;

interface AddToChannelModalProps {
    user: UserProfile;
    channelId: string;
    setOwner: (id: string) => void;
    show: boolean;
    onHide: () => void;
}

const AddToChannelModal = ({user, channelId, setOwner, show, onHide}: AddToChannelModalProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const displayName = useFormattedUsername(user);

    if (!user) {
        return null;
    }

    return (
        <ConfirmModal
            show={show}
            title={formatMessage(
                {defaultMessage: 'Add {displayName} to Channel'},
                {displayName},
            )}
            message={formatMessage(
                {defaultMessage: '{displayName} is not a participant of the run. Would you like to make them a participant? They will have access to all of the message history in the run channel.'},
                {displayName},
            )}
            confirmButtonText={formatMessage({defaultMessage: 'Add'})}
            onConfirm={() => {
                dispatch(addChannelMember(channelId, user.id));
                setOwner(user.id);
                onHide();
            }}
            onCancel={onHide}
        />
    );
};

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

const ItemLink = styled(Link)`
    display: flex;
    flex-direction: row;
    align-items: center;

    svg {
        margin-left: 3px;
    }
`;

const ItemContent = styled.div`
    max-width: 230px;
    display: inline-flex;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    align-items: center;
`;

const ItemDisabledContent = styled(ItemContent)`
    svg {
        margin-right: 3px;
    }
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const OverviewRow = styled.div<{onClick?: () => void}>`
    padding: 10px 24px;
    height: 44px;
    display: flex;
    justify-content: space-between;

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    ${({onClick}) => onClick && css`
        cursor: pointer;
    `}

    ${AssignToContainer} {
        margin-left: 0;
        max-width: none;
    }
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
    font-size: 12px;
    height: 24px;
    padding: 0 10px;
    margin-right: 10px;
`;

const ParticipantsContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;
