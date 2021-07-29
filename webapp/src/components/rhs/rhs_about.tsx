// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import styled from 'styled-components';

import {PlaybookRun} from 'src/types/playbook_run';

import {setOwner, changeChannelName, updatePlaybookRunDescription} from 'src/client';
import ProfileSelector from 'src/components/profile/profile_selector';
import RHSPostUpdate from 'src/components/rhs/rhs_post_update';
import {useProfilesInCurrentChannel} from 'src/hooks';
import PostText from 'src/components/post_text';
import RHSParticipants from 'src/components/rhs/rhs_participants';
import {HoverMenu} from 'src/components/rhs/rhs_shared';
import RHSAboutButtons from 'src/components/rhs/rhs_about_buttons';
import {useClickOutsideRef, useKeyPress} from 'src/hooks/general';

interface Props {
    playbookRun: PlaybookRun;
}

const RHSAbout = (props: Props) => {
    const profilesInChannel = useProfilesInCurrentChannel();

    const [collapsed, setCollapsed] = useState(false);

    const toggleCollapsed = () => setCollapsed(!collapsed);

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

    const onTitleEdit = async (value: string) => {
        changeChannelName(props.playbookRun.channel_id, value);
    };

    const onDescriptionEdit = async (value: string) => {
        updatePlaybookRunDescription(props.playbookRun.id, value);
    };

    return (
        <Container tabIndex={0} >
            <ButtonsRow>
                <RHSAboutButtons
                    playbookRun={props.playbookRun}
                    collapsed={collapsed}
                    toggleCollapsed={toggleCollapsed}
                />
            </ButtonsRow>
            <Title
                value={props.playbookRun.name}
                onEdit={onTitleEdit}
            />
            {!collapsed &&
            <>
                <Description
                    value={props.playbookRun.description}
                    onEdit={onDescriptionEdit}
                />
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

interface DescriptionProps {
    value: string;
    onEdit: () => void;
}

const Description = (props: DescriptionProps) => {
    const placeholder = 'No description yet. Click here to edit it.';

    const [editing, setEditing] = useState(false);
    const [editedValue, setEditedValue] = useState(props.value || placeholder);

    const textareaRef = useRef(null);

    const saveAndClose = () => {
        const newValue = editedValue.trim();
        setEditedValue(newValue);
        props.onEdit(newValue);
        setEditing(false);
    };

    useClickOutsideRef(textareaRef, saveAndClose);
    useKeyPress((e: KeyboardEvent) => e.ctrlKey && e.key === 'Enter', saveAndClose);

    useEffect(() => {
        setEditedValue(props.value || placeholder);
    }, [props.value]);

    if (!editing) {
        return (
            <RenderedDescription onClick={() => setEditing(true)}>
                <PostText text={editedValue}/>
            </RenderedDescription>
        );
    }

    return (
        <DescriptionTextArea
            value={editedValue}
            ref={textareaRef}
            onChange={(e) => setEditedValue(e.target.value)}
            autoFocus={true}
            onFocus={(e) => {
                const val = e.target.value;
                e.target.value = '';
                e.target.value = val;
            }}
            rows={editedValue.split('\n').length}
        />
    );
};

const DescriptionTextArea = styled.textarea`
    resize: none;
    width: 100%;
    height: max-content;
    padding: 4px 8px;
    margin-top: -2px;
    margin-bottom: 9px;

    border: none;
    border-radius: 5px;
    box-shadow: none;

    background: rgba(var(--center-channel-color-rgb), 0.04);

    &:focus {
        box-shadow: none;
    }

    font-size: 14px;
    line-height: 15px;
    color: var(--center-channel-color);
`;

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

interface TitleProps {
    onEdit: (newTitle: string) => void;
    value: string;
}

const Title = (props: TitleProps) => {
    const [editing, setEditing] = useState(false);
    const [editedValue, setEditedValue] = useState(props.value);

    const inputRef = useRef(null);

    useEffect(() => {
        setEditedValue(props.value);
    }, [props.value]);

    const saveAndClose = () => {
        props.onEdit(editedValue);
        setEditing(false);
    };

    useClickOutsideRef(inputRef, saveAndClose);
    useKeyPress('Enter', saveAndClose);

    if (!editing) {
        return (
            <RenderedTitle onClick={() => setEditing(true)} >
                {editedValue}
            </RenderedTitle>
        );
    }

    return (
        <TitleInput
            type={'text'}
            ref={inputRef}
            onChange={(e) => setEditedValue(e.target.value)}
            value={editedValue}
            maxLength={59}
            autoFocus={true}
            onFocus={(e) => {
                const val = e.target.value;
                e.target.value = '';
                e.target.value = val;
            }}
        />
    );
};

const TitleInput = styled.input`
    width: calc(100% - 75px);
    height: 30px;
    padding: 4px 8px;
    margin-bottom: 5px;
    margin-top: -3px;

    border: none;
    border-radius: 5px;
    box-shadow: none;

    background: rgba(var(--center-channel-color-rgb), 0.04);

    &:focus {
        box-shadow: none;
    }

    color: var(--center-channel-color);
    font-size: 18px;
    line-height: 24px;
    font-weight: 600;
`;

const RenderedTitle = styled(PaddedContent)`
    max-width: 100%;
    ${Container}:focus-within &, ${Container}:hover & {
        max-width: calc(100% - 75px);
    }

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

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

const RenderedDescription = styled(PaddedContent)`
    :hover {
        cursor: text;
    }

    border-radius: 5px;

    margin-bottom: 16px;
    line-height: 20px;
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
