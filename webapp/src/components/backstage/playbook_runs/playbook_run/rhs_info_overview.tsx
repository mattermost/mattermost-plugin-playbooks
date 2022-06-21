// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import Icon from '@mdi/react';
import {mdiAccountOutline, mdiAccountMultipleOutline, mdiBookOutline, mdiBullhornOutline} from '@mdi/js';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {UserProfile} from 'mattermost-redux/types/users';

import {SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {useToasts, ToastType} from 'src/components/backstage/toast_banner';
import Following from 'src/components/backstage/playbook_runs/playbook_run_backstage/following';
import AssignTo from 'src/components/checklist_item/assign_to';
import {UserList} from 'src/components/rhs/rhs_participants';
import {Section, SectionTitle} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_styles';
import {Role} from 'src/components/backstage/playbook_runs/shared';

import {followPlaybookRun, unfollowPlaybookRun, setOwner as clientSetOwner} from 'src/client';
import {pluginUrl} from 'src/browser_routing';
import {usePlaybook} from 'src/hooks';
import {PlaybookRun, Metadata} from 'src/types/playbook_run';

interface Props {
    run: PlaybookRun;
    runMetadata: Metadata | null;
    role: Role;
}

const RHSInfoOverview = ({run, runMetadata, role}: Props) => {
    const {formatMessage} = useIntl();
    const playbook = usePlaybook(run.playbook_id);
    const addToast = useToasts().add;
    const [FollowingButton, followers] = useFollowing(run.id, runMetadata?.followers || []);

    const onOwnerChange = async (userType?: string, user?: UserProfile) => {
        if (!user) {
            return;
        }

        try {
            const response = await clientSetOwner(run.id, user.id);

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

    return (
        <Section>
            <SectionTitle>{formatMessage({defaultMessage: 'Overview'})}</SectionTitle>
            <Item
                iconPath={mdiBookOutline}
                name={formatMessage({defaultMessage: 'Playbook'})}
            >
                {playbook && <Link to={pluginUrl(`/playbooks/${run.playbook_id}`)}>{playbook.title}</Link>}
            </Item>
            <Item
                iconPath={mdiAccountOutline}
                name={formatMessage({defaultMessage: 'Owner'})}
            >
                <AssignTo
                    assignee_id={run.owner_user_id}
                    editable={role === Role.Participant}
                    onSelectedChange={onOwnerChange}
                    dropdownMoveRightPx={0}
                />
            </Item>
            <Item
                iconPath={mdiAccountMultipleOutline}
                name={formatMessage({defaultMessage: 'Participants'})}
            >
                <Participants>
                    <UserList
                        userIds={run.participant_ids}
                        sizeInPx={20}
                    />
                </Participants>
            </Item>
            <Item
                iconPath={mdiBullhornOutline}
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
        </Section>
    );
};

export default RHSInfoOverview;

const useFollowing = (runID: string, metadataFollowers: string[]) => {
    const {formatMessage} = useIntl();
    const addToast = useToasts().add;
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
                addToast(formatMessage({defaultMessage: 'It was not possible to unfollow the run'}), ToastType.Failure);
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
    iconPath: string;
    name: string;
    children: React.ReactNode;
}

const Item = (props: ItemProps) => (
    <OverviewRow>
        <OverviewItemName>
            <OverviewIcon
                path={props.iconPath}
                size={'18px'}
            />
            {props.name}
        </OverviewItemName>
        {props.children}
    </OverviewRow>
);

const OverviewRow = styled.div`
    padding: 10px 24px;
    display: flex;
    justify-content: space-between;

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const OverviewItemName = styled.div`
    display: flex;
    align-items: center;
`;

const OverviewIcon = styled(Icon)`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-right: 11px;
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
