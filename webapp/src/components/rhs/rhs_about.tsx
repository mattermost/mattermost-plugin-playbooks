// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useDispatch} from 'react-redux';

import {PlaybookRun} from 'src/types/playbook_run';

import {setOwner} from 'src/client';
import ProfileSelector from 'src/components/profile/profile_selector';
import RHSPostUpdate from 'src/components/rhs/rhs_post_update';
import {useProfilesInCurrentChannel} from 'src/hooks';
import PostText from 'src/components/post_text';
import {updateStatus} from 'src/actions';
import RHSParticipants from 'src/components/rhs/rhs_participants';
import {HoverMenu} from 'src/components/rhs/rhs_shared';
import RHSAboutButtons from 'src/components/rhs/rhs_about_buttons';

interface Props {
    playbookRun: PlaybookRun;
}

const RHSAbout = (props: Props) => {
    const dispatch = useDispatch();
    const profilesInChannel = useProfilesInCurrentChannel();

    const [collapsed, setCollapsed] = useState(false);

    const toggleCollapsed = () => setCollapsed(!collapsed);

    let description = <PostText text={props.playbookRun.description}/>;
    if (props.playbookRun.status_posts.length === 0) {
        description = (
            <NoDescription>
                {'No description yet. '}
                <a
                    href={'#'}
                    tabIndex={0}
                    role={'button'}
                    onClick={() => dispatch(updateStatus())}
                    onKeyDown={(e) => {
                        // Handle Enter and Space as clicking on the button
                        if (e.keyCode === 13 || e.keyCode === 32) {
                            dispatch(updateStatus());
                        }
                    }}
                >{'Click here'}</a>
                {' to update status.'}
            </NoDescription>
        );
    }

    const fetchUsers = async () => {
        return profilesInChannel;
    };

    const onSelectedProfileChange = async (userId?: string) => {
        if (!userId) {
            return;
        }
        const response = await setOwner(props.playbookRun.id, userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
    };

    const participantsIds = profilesInChannel
        .filter((p) => p.id !== props.playbookRun.owner_user_id && !p.is_bot)
        .map((p) => p.id);

    return (
        <Container tabIndex={0} >
            <ButtonsRow>
                <RHSAboutButtons
                    playbookRun={props.playbookRun}
                    collapsed={collapsed}
                    toggleCollapsed={toggleCollapsed}
                />
            </ButtonsRow>
            <Title>
                {props.playbookRun.name}
            </Title>
            {!collapsed &&
            <>
                <Description>
                    {description}
                </Description>
                <Row>
                    <OwnerSection>
                        <MemberSectionTitle>{'Owner'}</MemberSectionTitle>
                        <StyledProfileSelector
                            selectedUserId={props.playbookRun.owner_user_id}
                            placeholder={'Assign the owner role'}
                            placeholderButtonClass={'NoAssignee-button'}
                            profileButtonClass={'Assigned-button'}
                            enableEdit={true}
                            getUsers={fetchUsers}
                            onSelectedChange={onSelectedProfileChange}
                            selfIsFirstOption={true}
                        />
                    </OwnerSection>
                    <ParticipantsSection>
                        <MemberSectionTitle>{'Participants'}</MemberSectionTitle>
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
    );
};

const Container = styled.div`
    margin-top: 3px;
    padding: 16px 12px;

    :hover, :focus-within {
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
        background: var(--center-channel-color-08);
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

    ${Container}:focus-within &, ${Container}:hover & {
        display: block;
    }
`;

const PaddedContent = styled.div`
    padding: 0 8px; 
`;

const Title = styled(PaddedContent)`
    height: 30px;
    line-height: 24px;

    font-size: 18px;
    font-weight: 600;

    color: var(--center-channel-color);

    :hover {
        cursor: text;
    }

    border-radius: 5px;

    margin-bottom: 2px;
`;

const Description = styled(PaddedContent)`
    :hover {
        cursor: text;
    }

    border-radius: 5px;

    margin-bottom: 16px;
`;

const Row = styled(PaddedContent)`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;

    margin-bottom: 30px;
`;

const MemberSection = styled.div`
    :not(:first-child) {
        margin-left: 36px;
    }
`;

const OwnerSection = styled(MemberSection)`
    max-width: calc(100% - 205px);
`;

const ParticipantsSection = styled(MemberSection)`
`;

const MemberSectionTitle = styled.div`
    font-weight: 600;
    font-size: 12px;
    line-height: 16px;

    color: rgba(var(--center-channel-color-rgb), 0.72)
`;

const NoDescription = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    margin-bottom: 10px;
`;

export default RHSAbout;
