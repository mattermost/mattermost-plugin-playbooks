// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useEffect} from 'react';
import {Redirect, useParams, useLocation} from 'react-router-dom';
import {useSelector, useDispatch} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {searchProfiles} from 'mattermost-redux/actions/users';

import {Team} from 'mattermost-redux/types/teams';

import styled from 'styled-components';

import {PresetTemplates} from 'src/components/backstage/template_selector';

import {teamPluginErrorUrl} from 'src/browser_routing';
import {Playbook, Checklist, emptyPlaybook} from 'src/types/playbook';
import {savePlaybook, clientFetchPlaybook} from 'src/client';
import {StagesAndStepsEdit} from 'src/components/backstage/stages_and_steps_edit';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import Spinner from 'src/components/assets/icons/spinner';
import {ErrorPageTypes, TEMPLATE_TITLE_KEY} from 'src/constants';

import './playbook.scss';
import StagesAndStepsIcon from './stages_and_steps_icon';
import {BackstageNavbar, BackstageNavbarBackIcon} from './backstage';
import EditableText from './editable_text';
import SharePlaybook from './share_playbook';

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

const EditHeader = styled.div`
    height: 56px;
    padding: 8px 32px;
    box-shadow: 0px 1px 0px var(--center-channel-color-16), 0px 0px 0px var(--center-channel-color-16);
    white-space: nowrap;
`;

const EditHeaderTextContainer = styled.span`
    display: inline-flex;
    flex-direction: column;
    margin-left: 12px;
    vertical-align: middle;
`;

const EditHeaderText = styled.span`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
`;

const EditHeaderHelpText = styled.span`
    font-weight: normal;
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const EditContent = styled.div`
    flex-grow: 1;
    padding: 8px;
`;

const Sidebar = styled.div`
    width: 408px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    box-shadow: 1px 0px 0px var(--center-channel-color-16), -1px 0px 0px var(--center-channel-color-16);
`;

const SidebarHeader = styled.div`
    height: 56px;
    padding: 16px;
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    box-shadow: 0px 1px 0px var(--center-channel-color-16), 0px 0px 0px var(--center-channel-color-16);
`;

const SidebarHeaderText = styled.div`
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    margin: 18px 0;
`;

const SidebarContent = styled.div`
    flex-grow: 1;
    padding: 6px 24px;
`;

const NavbarPadding = styled.div`
    flex-grow: 1;
`;

const SaveButton = styled.button`
    display: inline-flex;
    background: var(--button-bg);
    color: var(--button-color);
    border-radius: 4px;
    border: 0px;
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 16px;
    line-height: 18px;
    align-items: center;
    padding: 12px 20px;
    transition: all 0.15s ease-out;

    &:hover {
        opacity: 0.8;
    }

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.8);
    }

    &:disabled {
        background: rgba(var(--button-bg-rgb), 0.4);
    }

    i {
        font-size: 24px;
    }
`;

const EditableTextContainer = styled.div`
    padding: 15px;
    font-size: 20px;
    line-height: 28px;
    color: var(--center-channel-color);
`;

const RadioContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const RadioLabel = styled.label`
    && {
        font-size: 14px;
        font-weight: normal;
        line-height: 20px;
    }
`;

const RadioInput = styled.input`
    && {
        margin: 0 8px;
    }
`;

const OuterContainer = styled.div`
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

    const saveDisabled = playbook.title.trim() === '' || playbook.member_ids.length === 0 || playbook.checklists.length === 0 || !changesMade;

    const onSave = async () => {
        if (saveDisabled) {
            return;
        }

        const playbookExcludingEmpty = {
            ...playbook,
            checklists: playbook.checklists.map((checklist) => (
                {
                    ...checklist,
                    items: checklist.items.filter((item) => item.title || item.command),
                }
            )).filter((checklist) => !checklist.items || checklist.items.length > 0),
        };

        // It's possible there was actually nothing there.
        if (playbookExcludingEmpty.checklists.length === 0) {
            return;
        }

        await savePlaybook(playbookExcludingEmpty);
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
        setPlaybook({
            ...playbook,
            title,
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

    if (!props.isNew) {
        switch (fetchingState) {
        case FetchingStateType.notFound:
            return <Redirect to={teamPluginErrorUrl(props.currentTeam.name, ErrorPageTypes.PLAYBOOKS)}/>;
        case FetchingStateType.loading:
            return (
                <div className='Playbook container-medium text-center'>
                    <Spinner/>
                </div>
            );
        }
    }

    return (
        <OuterContainer>
            <BackstageNavbar>
                <BackstageNavbarBackIcon
                    className='icon-arrow-back-ios back-icon'
                    onClick={confirmOrClose}
                />
                <EditableTextContainer>
                    <EditableText
                        text={playbook.title}
                        onChange={handleTitleChange}
                    />
                </EditableTextContainer>
                <NavbarPadding/>
                <SaveButton
                    onClick={onSave}
                    disabled={saveDisabled}
                >
                    {'Save'}
                </SaveButton>
            </BackstageNavbar>
            <Container>
                <EditView>
                    <EditHeader>
                        <StagesAndStepsIcon/>
                        <EditHeaderTextContainer>
                            <EditHeaderText>{'Stages and Steps'}</EditHeaderText>
                            <EditHeaderHelpText>{'Stages allow you to group your tasks. Steps are meant to be completed by members of the incident channel.'}</EditHeaderHelpText>
                        </EditHeaderTextContainer>
                    </EditHeader>
                    <EditContent>
                        <StagesAndStepsEdit
                            checklists={playbook.checklists}
                            onChange={updateChecklist}
                        />
                    </EditContent>
                </EditView>
                <Sidebar>
                    <SidebarHeader>
                        {'Settings'}
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarHeaderText>
                            {'Channel Type'}
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
                        <SidebarHeaderText>
                            {'Share Playbook'}
                        </SidebarHeaderText>
                        <SharePlaybook
                            onAddUser={handleUsersInput}
                            onRemoveUser={handleRemoveUser}
                            searchProfiles={searchUsers}
                            playbook={playbook}
                        />
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
