// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {UserProfile} from 'mattermost-redux/types/users';
import { getChannelByName } from 'mattermost-webapp/packages/mattermost-redux/src/utils/channel_utils';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {setOwner, changeChannelName, updatePlaybookRunDescription} from 'src/client';
import ProfileSelector from 'src/components/profile/profile_selector';
import RHSPostUpdate from 'src/components/rhs/rhs_post_update';
import {useProfilesInCurrentChannel, useProfilesInTeam} from 'src/hooks';
import RHSParticipants from 'src/components/rhs/rhs_participants';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {HoverMenu} from 'src/components/rhs/rhs_shared';
import RHSAboutButtons from 'src/components/rhs/rhs_about_buttons';
import RHSAboutTitle, {DefaultRenderedTitle} from 'src/components/rhs/rhs_about_title';
import RHSAboutDescription from 'src/components/rhs/rhs_about_description';
import {currentRHSAboutCollapsedState} from 'src/selectors';
import {setRHSAboutCollapsedState, addToChannel} from 'src/actions';

interface Props {
    playbookRun: PlaybookRun;
}

const RHSAbout = (props: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const channelId = useSelector(getCurrentChannelId);
    const profilesInChannel = useProfilesInCurrentChannel();
    const profilesInTeam = useProfilesInTeam();
    const collapsed = useSelector(currentRHSAboutCollapsedState);
    const [showAddToChannel, setShowAddToChannelConfirm] = useState(false);
    const [currentUserSelect, setCurrentUserSelect] = useState<UserProfile | null>();

    const toggleCollapsed = () => dispatch(setRHSAboutCollapsedState(channelId, !collapsed));

    const fetchUsers = async () => {
        return profilesInChannel;
    };

    const fetchUsersInTeam = async () => {
        return profilesInTeam;
    }

    const setOwnerUtil = async (userId?: string) => {
        if(!userId){
            return
        }
        const response = await setOwner(props.playbookRun.id, userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
    }

    const onSelectedProfileChange = (userId?: string, userType?: string, userObj?: UserProfile) => {
        if (!userId || !userType) {
            return;
        }
        
        if(userType === "Member"){
            setOwnerUtil(userId)
        }
        else{
            console.log(userObj)
            setCurrentUserSelect(userObj)
            setShowAddToChannelConfirm(true);
        }
    };

    const participantsIds = profilesInChannel
        .filter((p) => p.id !== props.playbookRun.owner_user_id && !p.is_bot)
        .map((p) => p.id);

    const onTitleEdit = (value: string) => {
        changeChannelName(props.playbookRun.channel_id, value);
    };

    const onDescriptionEdit = (value: string) => {
        updatePlaybookRunDescription(props.playbookRun.id, value);
    };

    const isFinished = props.playbookRun.current_status === PlaybookRunStatus.Finished;

    return (
        <>
            <Container tabIndex={0}>
                <ButtonsRow>
                    <RHSAboutButtons
                        playbookRun={props.playbookRun}
                        collapsed={collapsed}
                        toggleCollapsed={toggleCollapsed}
                    />
                </ButtonsRow>
                <RHSAboutTitle
                    value={props.playbookRun.name}
                    onEdit={onTitleEdit}
                    renderedTitle={RenderedTitle}
                    status={props.playbookRun.current_status}
                />
                {!collapsed &&
                <>
                    <RHSAboutDescription
                        value={props.playbookRun.summary}
                        onEdit={onDescriptionEdit}
                    />
                    <Row>
                        <OwnerSection>
                            <MemberSectionTitle>{formatMessage({defaultMessage: 'Owner'})}</MemberSectionTitle>
                            <StyledProfileSelector
                                selectedUserId={props.playbookRun.owner_user_id}
                                placeholder={formatMessage({defaultMessage: 'Assign the owner role'})}
                                placeholderButtonClass={'NoAssignee-button'}
                                profileButtonClass={'Assigned-button'}
                                enableEdit={!isFinished}
                                getUsers={fetchUsers}
                                getUsersInTeam={fetchUsersInTeam}
                                onSelectedChange={onSelectedProfileChange}
                                selfIsFirstOption={true}
                            />
                        </OwnerSection>
                        <ParticipantsSection>
                            <MemberSectionTitle>{formatMessage({defaultMessage: 'Participants'})}</MemberSectionTitle>
                            <RHSParticipants userIds={participantsIds}/>
                        </ParticipantsSection>
                    </Row>
                </>
                }
                <RHSPostUpdate
                    collapsed={collapsed}
                    playbookRun={props.playbookRun}
                    updatesExist={props.playbookRun.status_posts.length !== 0}
                />
            </Container>
            <ConfirmModal
                show={showAddToChannel}
                title={formatMessage({defaultMessage: 'Add {fname} {lname} to Channel'}, {fname: currentUserSelect?.first_name, lname: currentUserSelect?.last_name})}
                message={formatMessage({defaultMessage: '@{fname} {lname} is not a member of the ? channel. Would you like to add them to this channel? They will have access to all message history.'}, {fname: currentUserSelect?.first_name, lname: currentUserSelect?.last_name})}
                confirmButtonText={formatMessage({defaultMessage: 'Add'})}
                onConfirm={() => {
                    if(currentUserSelect){
                        dispatch(addToChannel(currentUserSelect.id))
                        setShowAddToChannelConfirm(false)
                        // lets set the added user now
                        setOwnerUtil(currentUserSelect.id)
                    }
                }
                }
                onCancel={() => setShowAddToChannelConfirm(false)}
            />
        </>
    );
};

const Container = styled.div`
    margin-top: 3px;
    padding: 16px 12px;

    :hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

const StyledProfileSelector = styled(ProfileSelector)`
    margin-top: 8px;

    .Assigned-button {
        max-width: 100%;
        height: 28px;
        padding: 2px;
        margin-top: 0;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);

        :hover {
            background: rgba(var(--center-channel-color-rgb), 0.16);
        }

        .image {
            width: 24px;
            height: 24px;
        }
    }
`;

const ButtonsRow = styled(HoverMenu)`
    top: 9px;
    right: 12px;

    display: none;

    ${Container}:hover & {
        display: block;
    }
`;

const RenderedTitle = styled(DefaultRenderedTitle)`
    ${Container}:hover & {
        max-width: calc(100% - 75px);
    }
`;

const Row = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;

    padding: 0 8px;
    margin-bottom: 30px;
`;

const MemberSection = styled.div`
    :not(:first-child) {
        margin-left: 36px;
    }
`;

const OwnerSection = styled(MemberSection)`
    max-width: calc(100% - 210px);
`;

const ParticipantsSection = styled(MemberSection)`
`;

const MemberSectionTitle = styled.div`
    font-weight: 600;
    font-size: 12px;
    line-height: 16px;

    color: rgba(var(--center-channel-color-rgb), 0.72)
`;

export default RHSAbout;
