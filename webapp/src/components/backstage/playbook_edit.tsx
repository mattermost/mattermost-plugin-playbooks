// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useEffect, useCallback} from 'react';
import {Redirect, useParams, useLocation} from 'react-router-dom';
import {useSelector, useDispatch} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getProfilesInTeam, searchProfiles} from 'mattermost-redux/actions/users';
import {searchChannels as searchChannelsInTeam} from 'mattermost-redux/actions/channels';

import {Team} from 'mattermost-redux/types/teams';

import styled from 'styled-components';

import {Tabs, TabsContent} from 'src/components/tabs';

import {PresetTemplates} from 'src/components/backstage/template_selector';

import {teamPluginErrorUrl} from 'src/browser_routing';
import {Playbook, Checklist, emptyPlaybook} from 'src/types/playbook';
import {savePlaybook, clientFetchPlaybook} from 'src/client';
import {StagesAndStepsEdit} from 'src/components/backstage/stages_and_steps_edit';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {ErrorPageTypes, TEMPLATE_TITLE_KEY} from 'src/constants';
import {PrimaryButton} from 'src/components/assets/buttons';
import {BackstageNavbar, BackstageNavbarIcon} from 'src/components/backstage/backstage';

import './playbook.scss';
import StagesAndStepsIcon from './stages_and_steps_icon';
import EditableText from './editable_text';
import SharePlaybook from './share_playbook';
import ChannelSelector from './channel_selector';

const Container = styled.div`
    display: flex;
    flex-direction: row;
    flex-grow: 1;
    align-items: stretch;
    width: 100%;
`;

const EditView = styled.div`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    flex-grow: 1;
`;

const TabsHeader = styled.div`
    height: 72px;
    display: flex;
    padding: 0 32px;
    border-bottom: 1px solid var(--center-channel-color-16);
    white-space: nowrap;
`;

const EditContent = styled.div`
    background: var(--center-channel-color-04);
    flex-grow: 1;
`;

const Sidebar = styled.div`
    width: 400px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    border-left: 1px solid var(--center-channel-color-16);
`;

const SidebarBlock = styled.div`
    margin: 0 0 40px;
`;

const SidebarHeader = styled.div`
    display: flex;
    align-items: center;
    height: 72px;
    padding: 0 24px;
    font-weight: 600;
    font-size: 16px;
    border-bottom: 1px solid var(--center-channel-color-16);
`;

const SidebarHeaderText = styled.div`
    font-weight: 600;
    margin: 0 0 16px;
`;

const SidebarHeaderDescription = styled.div`
    margin: 8px 0 0;
    font-weight: 400;
    color: var(--center-channel-color-64);
`;

const SidebarContent = styled.div`
    background: var(--center-channel-bg);
    flex-grow: 1;
    padding: 24px;
`;

const NavbarPadding = styled.div`
    flex-grow: 1;
`;

const EditableTexts = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: 15px;
`;

const EditableTitleContainer = styled.div`
    font-size: 20px;
    line-height: 28px;
`;

const EditableDescriptionContainer = styled.div`
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const RadioContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const RadioLabel = styled.label`
    && {
        margin: 0 0 8px;
        display: flex;
        align-items: center;
        font-size: 14px;
        font-weight: normal;
        line-height: 20px;
    }
`;

const RadioInput = styled.input`
    && {
        width: 16px;
        height: 16px;
        margin: 0 8px 0 0;
    }
`;

const OuterContainer = styled.div`
    background: var(center-channel-bg);
    display: flex;
    flex-direction: column;
    height: 100%;
`;

interface Props {
    isNew: boolean;
    currentTeam: Team;
    onClose: () => void;
}

interface URLParams {
    playbookId?: string;
}

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

// setPlaybookDefaults fills in a playbook with defaults for any fields left empty.
const setPlaybookDefaults = (playbook: Playbook) => ({
    ...playbook,
    title: playbook.title.trim() || 'Untitled Playbook',
    checklists: playbook.checklists.map((checklist) => ({
        ...checklist,
        title: checklist.title || 'Untitled Stage',
        items: checklist.items.map((item) => ({
            ...item,
            title: item.title || 'Untitled Step',
        })),
    })),
});

const PlaybookEdit: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();

    const currentUserId = useSelector(getCurrentUserId);

    const [playbook, setPlaybook] = useState<Playbook>({
        ...emptyPlaybook(),
        team_id: props.currentTeam.id,
        member_ids: [currentUserId],
    });
    const [changesMade, setChangesMade] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const urlParams = useParams<URLParams>();
    const location = useLocation();

    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);

    const [currentTab, setCurrentTab] = useState<number>(0);

    useEffect(() => {
        const fetchData = async () => {
            // No need to fetch anything if we're adding a new playbook
            if (props.isNew) {
                // Use preset template if specified
                const searchParams = new URLSearchParams(location.search);
                const templateTitle = searchParams.get(TEMPLATE_TITLE_KEY);
                if (templateTitle) {
                    const template = PresetTemplates.find((t) => t.title === templateTitle);
                    if (!template) {
                        // eslint-disable-next-line no-console
                        console.error('Failed to find template using template key =', templateTitle);
                        return;
                    }

                    setPlaybook({
                        ...template.template,
                        team_id: props.currentTeam.id,
                        member_ids: [currentUserId],
                    });
                    setChangesMade(true);
                }
                return;
            }

            if (urlParams.playbookId) {
                try {
                    const fetchedPlaybook = await clientFetchPlaybook(urlParams.playbookId);
                    fetchedPlaybook.member_ids = fetchedPlaybook.member_ids || [currentUserId];
                    setPlaybook(fetchedPlaybook);
                    setFetchingState(FetchingStateType.fetched);
                } catch {
                    setFetchingState(FetchingStateType.notFound);
                }
            }
        };
        fetchData();
    }, [urlParams.playbookId, props.isNew]);

    const onSave = async () => {
        await savePlaybook(setPlaybookDefaults(playbook));

        props.onClose();
    };

    const updateChecklist = (newChecklist: Checklist[]) => {
        setPlaybook({
            ...playbook,
            checklists: newChecklist,
        });
        setChangesMade(true);
    };

    const handleTitleChange = (title: string) => {
        if (title.trim().length === 0) {
            // Keep the original title from the props.
            return;
        }

        setPlaybook({
            ...playbook,
            title,
        });
        setChangesMade(true);
    };

    const handleDescriptionChange = (description: string) => {
        setPlaybook({
            ...playbook,
            description,
        });
        setChangesMade(true);
    };

    const confirmOrClose = () => {
        if (changesMade) {
            setConfirmOpen(true);
        } else {
            props.onClose();
        }
    };

    const confirmCancel = () => {
        setConfirmOpen(false);
    };

    const handlePublicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPlaybook({
            ...playbook,
            create_public_incident: e.target.value === 'public',
        });
        setChangesMade(true);
    };

    const handleUsersInput = (userId: string) => {
        setPlaybook({
            ...playbook,
            member_ids: [...playbook.member_ids, userId],
        });
        setChangesMade(true);
    };

    const handleRemoveUser = (userId: string) => {
        const idx = playbook.member_ids.indexOf(userId);
        setPlaybook({
            ...playbook,
            member_ids: [...playbook.member_ids.slice(0, idx), ...playbook.member_ids.slice(idx + 1)],
        });
        setChangesMade(true);
    };

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: props.currentTeam.id}));
    };

    const getUsers = () => {
        return dispatch(getProfilesInTeam(props.currentTeam.id, 0));
    };

    const searchChannels = (term: string) => {
        return dispatch(searchChannelsInTeam(props.currentTeam.id, term));
    };

    const handleBroadcastInput = (channelId: string) => {
        setPlaybook({
            ...playbook,
            broadcast_channel_id: channelId,
        });
        setChangesMade(true);
    };

    if (!props.isNew) {
        switch (fetchingState) {
        case FetchingStateType.notFound:
            return <Redirect to={teamPluginErrorUrl(props.currentTeam.name, ErrorPageTypes.PLAYBOOKS)}/>;
        case FetchingStateType.loading:
            return null;
        }
    }

    return (
        <OuterContainer>
            <BackstageNavbar
                data-testid='backstage-nav-bar'
            >
                <BackstageNavbarIcon
                    data-testid='icon-arrow-left'
                    className='icon-arrow-left back-icon'
                    onClick={confirmOrClose}
                />
                <EditableTexts>
                    <EditableTitleContainer>
                        <EditableText
                            id='playbook-name'
                            text={playbook.title}
                            onChange={handleTitleChange}
                            placeholder={'Untitled Playbook'}
                        />
                    </EditableTitleContainer>
                    <EditableDescriptionContainer>
                        <EditableText
                            id='playbook-description'
                            text={playbook.description}
                            onChange={handleDescriptionChange}
                            placeholder={'Playbook description'}
                        />
                    </EditableDescriptionContainer>
                </EditableTexts>
                <NavbarPadding/>
                <PrimaryButton
                    className='mr-4'
                    data-testid='save_playbook'
                    onClick={onSave}
                >
                    <span>
                        {'Save'}
                    </span>
                </PrimaryButton>
            </BackstageNavbar>
            <Container>
                <EditView>
                    <TabsHeader>
                        <Tabs
                            currentTab={currentTab}
                            setCurrentTab={setCurrentTab}
                        >
                            {'Tasks'}
                            {'Preferences'}
                        </Tabs>
                    </TabsHeader>
                    <EditContent>
                        <TabsContent
                            currentTab={currentTab}
                        >
                            <StagesAndStepsEdit
                                checklists={playbook.checklists}
                                onChange={updateChecklist}
                            />
                            {'TODO MM-30519 implement preferences.'}
                        </TabsContent>
                    </EditContent>
                </EditView>
                <Sidebar
                    data-testid='playbook-sidebar'
                >
                    <SidebarHeader>
                        {'Permissions'}
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarBlock>
                            <SidebarHeaderText>
                                {'Channel access'}
                                <SidebarHeaderDescription>
                                    {'Determine the type of incident channel this playbook creates when starting an incident.'}
                                </SidebarHeaderDescription>
                            </SidebarHeaderText>
                            <RadioContainer>
                                <RadioLabel>
                                    <RadioInput
                                        type='radio'
                                        name='public'
                                        value={'public'}
                                        checked={playbook.create_public_incident}
                                        onChange={handlePublicChange}
                                    />
                                    {'Public'}
                                </RadioLabel>
                                <RadioLabel>
                                    <RadioInput
                                        type='radio'
                                        name='public'
                                        value={'private'}
                                        checked={!playbook.create_public_incident}
                                        onChange={handlePublicChange}
                                    />
                                    {'Private'}
                                </RadioLabel>
                            </RadioContainer>
                        </SidebarBlock>
                        <SidebarBlock>
                            <SidebarHeaderText>
                                {'Playbook access'}
                                <SidebarHeaderDescription>
                                    {'Only people who you share with can create an incident from this playbook.'}
                                </SidebarHeaderDescription>
                            </SidebarHeaderText>
                            <SharePlaybook
                                onAddUser={handleUsersInput}
                                onRemoveUser={handleRemoveUser}
                                searchProfiles={searchUsers}
                                getProfiles={getUsers}
                                playbook={playbook}
                            />
                        </SidebarBlock>
                        <SidebarBlock>
                            <SidebarHeaderText>
                                {'Broadcast Channel'}
                                <SidebarHeaderDescription>
                                    {'Broadcast the incident status to an additional channel. All status posts will be shared automatically with both the incident and broadcast channel.'}
                                </SidebarHeaderDescription>
                            </SidebarHeaderText>
                            <ChannelSelector
                                searchChannels={searchChannels}
                                onChannelSelected={handleBroadcastInput}
                                playbook={playbook}
                            />
                        </SidebarBlock>
                    </SidebarContent>
                </Sidebar>
            </Container>
            <ConfirmModal
                show={confirmOpen}
                title={'Confirm discard'}
                message={'Are you sure you want to discard your changes?'}
                confirmButtonText={'Discard Changes'}
                onConfirm={props.onClose}
                onCancel={confirmCancel}
            />
        </OuterContainer>
    );
};

export default PlaybookEdit;
