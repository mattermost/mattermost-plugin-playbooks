// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {Redirect, useParams} from 'react-router-dom';
import {useSelector, useDispatch} from 'react-redux';
import styled from 'styled-components';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getProfilesInTeam, searchProfiles} from 'mattermost-redux/actions/users';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {fetchMyChannelsAndMembers} from 'mattermost-redux/actions/channels';
import {useIntl, FormattedMessage} from 'react-intl';
import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';

import {Tabs, TabsContent} from 'src/components/tabs';
import {PresetTemplates} from 'src/components/templates/template_data';
import {navigateToPluginUrl, pluginErrorUrl} from 'src/browser_routing';
import {
    DraftPlaybookWithChecklist,
    PlaybookWithChecklist,
    Checklist,
    emptyPlaybook,
    Metric,
} from 'src/types/playbook';
import {savePlaybook, clientFetchPlaybook} from 'src/client';
import {StagesAndStepsEdit} from 'src/components/backstage/playbook_edit/stages_and_steps_edit';
import {ErrorPageTypes, PROFILE_CHUNK_SIZE} from 'src/constants';
import {PrimaryButton} from 'src/components/assets/buttons';
import {BackstageNavbar} from 'src/components/backstage/backstage_navbar';
import RouteLeavingGuard from 'src/components/backstage/route_leaving_guard';
import {SecondaryButtonSmaller} from 'src/components/backstage/playbook_runs/shared';
import {RegularHeading} from 'src/styles/headings';
import EditTitleDescriptionModal from 'src/components/backstage/playbook_edit_title_description_modal';
import {useAllowRetrospectiveAccess} from 'src/hooks';
import StatusUpdatesEdit from 'src/components/backstage/playbook_edit/status_updates_edit';
import ActionsEdit from 'src/components/backstage/playbook_edit/actions_edit';
import RetrospectiveEdit from 'src/components/backstage/playbook_edit/retrospective_edit';

import {PlaybookRole} from 'src/types/permissions';

interface Props {
    isNew: boolean;
    teamId?: string;
    name?: string;
    template?: string;
    description?: string;
    public?: boolean;
}

interface URLParams {
    playbookId?: string;
    tabId?: string;
}

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

// setPlaybookDefaults fills in a playbook with defaults for any fields left empty.
const setPlaybookDefaults = (playbook: DraftPlaybookWithChecklist) => ({
    ...playbook,
    title: playbook.title.trim() || 'Untitled playbook',
    checklists: playbook.checklists.map((checklist) => ({
        ...checklist,
        title: checklist.title || 'Untitled checklist',
        items: checklist.items.map((item) => ({
            ...item,
            title: item.title || 'Untitled task',
        })),
    })),
});

export const tabInfo = [
    {id: 'checklists', name: <FormattedMessage defaultMessage='Checklists'/>},
    {id: 'actions', name: <FormattedMessage defaultMessage='Actions'/>},
    {id: 'status', name: <FormattedMessage defaultMessage='Status updates'/>},
    {id: 'retrospective', name: <FormattedMessage defaultMessage='Retrospective'/>},
] as const;

// @ts-ignore
const WebappUtils = window.WebappUtils;

const PlaybookNavbar = styled(BackstageNavbar)`
    top: 80px;
`;

export interface EditingMetric {
    index: number;
    metric: Metric;
}

const PlaybookEdit = (props: Props) => {
    const dispatch = useDispatch();

    const {formatMessage} = useIntl();

    const currentUserId = useSelector(getCurrentUserId);

    const [playbook, setPlaybook] = useState<DraftPlaybookWithChecklist | PlaybookWithChecklist>(() => {
        const initialPlaybook: DraftPlaybookWithChecklist = {
            ...(PresetTemplates.find((t) => t.title === props.template)?.template || emptyPlaybook()),
            reminder_timer_default_seconds: 86400,
            members: [{user_id: currentUserId, roles: [PlaybookRole.Member, PlaybookRole.Admin]}],
            team_id: props.teamId || '',
        };

        if (props.name) {
            initialPlaybook.title = props.name;
        }
        if (props.description) {
            initialPlaybook.description = props.description;
        }

        initialPlaybook.public = Boolean(props.public);

        return initialPlaybook;
    });
    const [changesMade, setChangesMade] = useState(false);
    const [curEditingMetric, setCurEditingMetric] = useState<EditingMetric | null>(null);

    const [showTitleDescriptionModal, setShowTitleDescriptionModal] = useState(false);

    const urlParams = useParams<URLParams>();

    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);

    let tab = 0;
    if (urlParams.tabId) {
        for (let i = 0; i < tabInfo.length; i++) {
            if (urlParams.tabId === tabInfo[i].id) {
                tab = i;
            }
        }
    }

    const [currentTab, setCurrentTab] = useState<number>(tab);

    const retrospectiveAccess = useAllowRetrospectiveAccess();

    useEffect(() => {
        const fetchData = async () => {
            if (urlParams.playbookId) {
                try {
                    const fetchedPlaybook = await clientFetchPlaybook(urlParams.playbookId);
                    if (fetchedPlaybook) {
                        fetchedPlaybook.members ??= [{user_id: currentUserId, roles: [PlaybookRole.Member, PlaybookRole.Admin]}];
                        fetchedPlaybook.metrics ??= [];
                        setPlaybook(fetchedPlaybook);
                    }
                    setFetchingState(FetchingStateType.fetched);
                } catch {
                    setFetchingState(FetchingStateType.notFound);
                }
            }
        };
        fetchData();
    }, [urlParams.playbookId, props.isNew, props.teamId, currentUserId]);

    useEffect(() => {
        const teamId = props.teamId || playbook.team_id;
        if (!teamId) {
            return;
        }

        dispatch(selectTeam(teamId));
        dispatch(fetchMyChannelsAndMembers(teamId));
        dispatch(fetchMyCategories(teamId));
    }, [dispatch, props.teamId, playbook.team_id]);

    const updateChecklist = (newChecklist: Checklist[]) => {
        setPlaybook({
            ...playbook,
            checklists: newChecklist,
        });
        setChangesMade(true);
    };

    const handleTitleAndDescriptionChange = (title: string, description: string) => {
        if (title.trim().length === 0) {
            // Keep the original title from the props, only change the description
            setPlaybook({
                ...playbook,
                description,
            });
            return;
        }

        setPlaybook({
            ...playbook,
            title,
            description,
        });
        setChangesMade(true);
    };

    const onSave = async () => {
        const pb = setPlaybookDefaults(playbook);

        pb.webhook_on_creation_urls = pb.webhook_on_creation_urls.filter((url) => url.trim().length > 0);
        pb.webhook_on_status_update_urls = pb.webhook_on_status_update_urls.filter((url) => url.trim().length > 0);

        const data = await savePlaybook(pb);
        setChangesMade(false);
        onClose(data?.id);
    };

    const onClose = (id?: string) => {
        const playbookId = urlParams.playbookId || id;
        if (playbookId) {
            navigateToPluginUrl(`/playbooks/${playbookId}`);
        } else {
            navigateToPluginUrl('/playbooks');
        }
    };

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: props.teamId || playbook.team_id}));
    };

    const getUsers = () => {
        return dispatch(getProfilesInTeam(props.teamId || playbook.team_id, 0, PROFILE_CHUNK_SIZE, '', {active: true}));
    };

    if (!props.isNew) {
        switch (fetchingState) {
        case FetchingStateType.notFound:
            return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOKS)}/>;
        case FetchingStateType.loading:
            return null;
        }
    } else if (!props.teamId) {
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOKS)}/>;
    }

    const playbookTitle = playbook.title || formatMessage({defaultMessage: 'Untitled playbook'});

    return (
        <OuterContainer>
            <PlaybookNavbar
                data-testid='backstage-nav-bar'
            >
                <TitleAndDescription onClick={() => setShowTitleDescriptionModal(true)}>
                    <Title>
                        {playbookTitle}
                        <i className='editable-trigger icon-pencil-outline'/>
                    </Title>
                    <Description>
                        {playbook.description || formatMessage({defaultMessage: 'Add playbook description...'})}
                    </Description>
                    <EditTitleDescriptionModal
                        onChange={handleTitleAndDescriptionChange}
                        show={showTitleDescriptionModal}
                        onHide={() => setShowTitleDescriptionModal(false)}
                        playbookTitle={playbookTitle}
                        playbookDescription={playbook.description}
                    />
                </TitleAndDescription>
                <NavbarPadding/>
                <SecondaryButtonLarger
                    className='mr-4'
                    onClick={() => onClose()}
                >
                    <span>
                        {formatMessage({defaultMessage: 'Cancel'})}
                    </span>
                </SecondaryButtonLarger>
                <PrimaryButton
                    className='mr-4'
                    data-testid='save_playbook'
                    onClick={onSave}
                >
                    <span>
                        {formatMessage({defaultMessage: 'Save'})}
                    </span>
                </PrimaryButton>
            </PlaybookNavbar>
            <Container>
                <EditView>
                    <TabsHeader>
                        <Tabs
                            currentTab={currentTab}
                            setCurrentTab={setCurrentTab}
                        >
                            {tabInfo.map(({id, name}) => <React.Fragment key={id}>{name}</React.Fragment>)}
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
                            <ActionsEdit
                                playbook={playbook}
                                setPlaybook={setPlaybook}
                                setChangesMade={setChangesMade}
                                searchUsers={searchUsers}
                                getUsers={getUsers}
                            />
                            <StatusUpdatesEdit
                                playbook={playbook}
                                setPlaybook={setPlaybook}
                                setChangesMade={setChangesMade}
                            />
                            <RetrospectiveEdit
                                playbook={playbook}
                                retrospectiveAccess={retrospectiveAccess}
                                setPlaybook={setPlaybook}
                                setChangesMade={setChangesMade}
                                curEditingMetric={curEditingMetric}
                                setCurEditingMetric={setCurEditingMetric}
                            />
                        </TabsContent>
                    </EditContent>
                </EditView>
            </Container>
            <RouteLeavingGuard
                navigate={(path) => WebappUtils.browserHistory.push(path)}
                shouldBlockNavigation={(newLoc) => location.pathname !== newLoc.pathname && changesMade}
            />
        </OuterContainer>
    );
};

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
    min-height: 72px;
    display: flex;
    padding: 0 32px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    white-space: nowrap;
`;

const EditContent = styled.div`
    background: rgba(var(--center-channel-color-rgb), 0.04);
    flex-grow: 1;
`;

const NavbarPadding = styled.div`
    flex-grow: 1;
`;

const SecondaryButtonLarger = styled(SecondaryButtonSmaller)`
    height: 40px;
    font-weight: 600;
    font-size: 14px;
    padding: 0 20px;
`;

const TitleAndDescription = styled.div`
    ${RegularHeading} {
    }

    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: 0 15px;
    font-weight: normal;

    cursor: pointer;

    i {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }

    :hover {
        i {
            color: var(--center-channel-color);
        }
    }
`;

const Title = styled.div`
    font-size: 20px;
    line-height: 28px;

    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 650px;
    white-space: nowrap;
`;

const Description = styled.div`
    font-size: 11px;
    line-height: 16px;

    color: rgba(var(--center-channel-color-rgb), 0.64);

    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 530px;
    white-space: nowrap;
`;

const OuterContainer = styled.div`
    background: var(center-channel-bg);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
`;

export default PlaybookEdit;
