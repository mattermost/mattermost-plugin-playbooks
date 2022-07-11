// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {AccountOutlineIcon, AccountMultipleOutlineIcon, BookOutlineIcon, BullhornOutlineIcon, ProductChannelsIcon, OpenInNewIcon} from '@mattermost/compass-icons/components';
import {addChannelMember} from 'mattermost-redux/actions/channels';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {UserProfile} from '@mattermost/types/users';

import {SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {useToaster, ToastType} from 'src/components/backstage/toast_banner';
import Following from 'src/components/backstage/playbook_runs/playbook_run_backstage/following';
import AssignTo from 'src/components/checklist_item/assign_to';
import {UserList} from 'src/components/rhs/rhs_participants';
import {Section, SectionHeader} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_styles';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

import {followPlaybookRun, unfollowPlaybookRun, setOwner as clientSetOwner} from 'src/client';
import {navigateToUrl, pluginUrl} from 'src/browser_routing';
import {usePlaybook, useFormattedUsername} from 'src/hooks';
import {PlaybookRun, Metadata} from 'src/types/playbook_run';
import {CompassIcon} from 'src/types/compass';

interface Props {
    run: PlaybookRun;
    runMetadata?: Metadata;
    editable: boolean;
    onViewParticipants: () => void;
}

const RHSInfoOverview = ({run, runMetadata, editable, onViewParticipants}: Props) => {
    const {formatMessage} = useIntl();
    const playbook = usePlaybook(run.playbook_id);
    const addToast = useToaster().add;
    const [showAddToChannel, setShowAddToChannel] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [FollowingButton, followers] = useFollowing(run.id, runMetadata?.followers || []);

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
                onClick={() => navigateToUrl(pluginUrl(`/playbooks/${run.playbook_id}`))}
            >
                {playbook && <ItemLink to={pluginUrl(`/playbooks/${run.playbook_id}`)}>{playbook.title}</ItemLink>}
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
                <Participants>
                    <UserList
                        userIds={run.participant_ids}
                        sizeInPx={20}
                    />
                </Participants>
            </Item>
            <Item
                id='runinfo-following'
                icon={BullhornOutlineIcon}
                name={formatMessage({defaultMessage: 'Following'})}
            >
                <FollowersWrapper>
                    <FollowingButton/>
                    <Following
                        userIds={followers}
                        hideHelpText={true}
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
            {runMetadata && editable && (
                <Item
                    id='runinfo-channel'
                    icon={ProductChannelsIcon}
                    name={formatMessage({defaultMessage: 'Channel'})}
                    onClick={() => navigateToUrl(`/${runMetadata.team_name}/channels/${runMetadata.channel_name}`)}
                >
                    <ItemLink to={`/${runMetadata.team_name}/channels/${runMetadata.channel_name}`}>
                        <ItemContent >
                            {runMetadata.channel_name}
                            <OpenInNewIcon
                                size={14}
                                color={'var(--button-bg)'}
                            />
                        </ItemContent>
                    </ItemLink>
                </Item>
            )}
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

const useFollowing = (runID: string, metadataFollowers: string[]) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const currentUser = useSelector(getCurrentUser);
    const [followers, setFollowers] = useState(metadataFollowers);
    const [isFollowing, setIsFollowing] = useState(followers.includes(currentUser.id));

    const toggleFollow = () => {
        const action = isFollowing ? unfollowPlaybookRun : followPlaybookRun;
        action(runID)
            .then(() => {
                const newFollowers = isFollowing ? followers.filter((userId) => userId !== currentUser.id) : [...followers, currentUser.id];
                setIsFollowing(!isFollowing);
                setFollowers(newFollowers);
            })
            .catch(() => {
                setIsFollowing(isFollowing);
                addToast(formatMessage({defaultMessage: 'It was not possible to {isFollowing, select, true {unfollow} other {follow}} the run'}, {isFollowing}), ToastType.Failure);
            });
    };

    const FollowingButton = () => {
        if (isFollowing) {
            return (
                <UnfollowButton onClick={toggleFollow}>
                    {formatMessage({defaultMessage: 'Following'})}
                </UnfollowButton>
            );
        }

        return (
            <FollowButton onClick={toggleFollow}>
                {formatMessage({defaultMessage: 'Follow'})}
            </FollowButton>
        );
    };

    return [FollowingButton, followers] as const;
};

interface ItemProps {
    id: string;
    icon: CompassIcon;
    name: string;
    children: React.ReactNode;
    onClick?: () => void;
}

const Item = (props: ItemProps) => {
    const StyledIcon = styled(props.icon)`
        margin-right: 11px;
    `;

    return (
        <OverviewRow
            onClick={props.onClick}
            data-testid={props.id}
        >
            <OverviewItemName>
                <StyledIcon
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
    max-width: 230px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const ItemContent = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;

    svg {
        margin-left: 3px;
    }
`;

const OverviewRow = styled.div<{onClick?: () => void}>`
    padding: 10px 24px;
    display: flex;
    justify-content: space-between;

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    ${({onClick}) => onClick && css`
        cursor: pointer;
    `}
`;

const OverviewItemName = styled.div`
    display: flex;
    align-items: center;
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

const FollowButton = styled(TertiaryButton)`
    font-size: 12px;
    height: 24px;
    padding: 0 10px;
`;

const UnfollowButton = styled(SecondaryButton)`
    font-size: 12px;
    height: 24px;
    padding: 0 10px;
`;
