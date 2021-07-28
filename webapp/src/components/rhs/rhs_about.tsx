// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useDispatch} from 'react-redux';

import {PlaybookRun} from 'src/types/playbook_run';

import {setOwner} from 'src/client';
import ProfileSelector from 'src/components/profile/profile_selector';
import './playbook_run_details.scss';
import RHSPostUpdate from 'src/components/rhs/rhs_post_update';
import {useProfilesInCurrentChannel} from 'src/hooks';
import PostText from 'src/components/post_text';
import {updateStatus} from 'src/actions';
import RHSParticipants from 'src/components/rhs/rhs_participants';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';

interface Props {
    playbookRun: PlaybookRun;
}

const RHSAbout = (props: Props) => {
    const dispatch = useDispatch();
    const profilesInChannel = useProfilesInCurrentChannel();

    const [collapsed, setCollapsed] = useState(false);

    const toggleCollapsed = () => setCollapsed(!collapsed);

    if (collapsed) {
        return (
            <Container tabIndex={0} >
                <Buttons
                    collapsed={collapsed}
                    toggleCollapsed={toggleCollapsed}
                />
                <Title>
                    {props.playbookRun.name}
                </Title>
                <RHSPostUpdate collapsed={collapsed}/>
            </Container>
        );
    }

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
            <Buttons
                collapsed={collapsed}
                toggleCollapsed={toggleCollapsed}
            />
            <Title>
                {props.playbookRun.name}
            </Title>
            <Description>
                {description}
            </Description>
            <Row>
                <MemberSection>
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
                </MemberSection>
                <MemberSection>
                    <MemberSectionTitle>{'Participants'}</MemberSectionTitle>
                    <RHSParticipants userIds={participantsIds}/>
                </MemberSection>
            </Row>
            <RHSPostUpdate collapsed={collapsed}/>
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
        padding: 2px;
        margin-top: 0;
        background: var(--center-channel-color-08);
        color: var(--center-channel-color-72);

        :hover {
            background: rgba(var(--center-channel-color-rgb), 0.16);
        }
    }
`;

interface ButtonsProps {
    collapsed: boolean;
    toggleCollapsed: () => void;
}

const Buttons = ({collapsed, toggleCollapsed} : ButtonsProps) => {
    return (
        <ButtonsRow>
            <HoverMenuButton
                title={collapsed ? 'Expand' : 'Collapse'}
                className={(collapsed ? 'icon-arrow-expand' : 'icon-arrow-collapse') + ' icon-16 btn-icon'}
                tabIndex={0}
                role={'button'}
                onClick={toggleCollapsed}
                onKeyDown={(e) => {
                    // Handle Enter and Space as clicking on the button
                    if (e.keyCode === 13 || e.keyCode === 32) {
                        toggleCollapsed();
                    }
                }}
            />
        </ButtonsRow>
    );
};

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
