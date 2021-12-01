// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {Redirect, useParams, useLocation} from 'react-router-dom';
import {useSelector, useDispatch} from 'react-redux';
import styled from 'styled-components';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getProfilesInTeam, searchProfiles} from 'mattermost-redux/actions/users';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {fetchMyChannelsAndMembers} from 'mattermost-redux/actions/channels';
import {useIntl, FormattedMessage} from 'react-intl';

import {Tabs, TabsContent} from 'src/components/tabs';
import {PresetTemplates} from 'src/components/backstage/template_selector';
import {navigateToPluginUrl, pluginErrorUrl} from 'src/browser_routing';
import {
    DraftPlaybookWithChecklist,
    PlaybookWithChecklist,
    Checklist,
    emptyPlaybook,
} from 'src/types/playbook';
import {savePlaybook, clientFetchPlaybook} from 'src/client';
import {StagesAndStepsEdit} from 'src/components/backstage/stages_and_steps_edit';
import {ErrorPageTypes, TEMPLATE_TITLE_KEY, PROFILE_CHUNK_SIZE} from 'src/constants';
import {PrimaryButton} from 'src/components/assets/buttons';
import {BackstageNavbar} from 'src/components/backstage/backstage_navbar';
import {AutomationSettings} from 'src/components/backstage/automation/settings';
import RouteLeavingGuard from 'src/components/backstage/route_leaving_guard';
import {SecondaryButtonSmaller} from 'src/components/backstage/playbook_runs/shared';
import {RegularHeading} from 'src/styles/headings';
import DefaultUpdateTimer from 'src/components/backstage/default_update_timer';
import EditTitleDescriptionModal from 'src/components/backstage/playbook_edit_title_description_modal';

import {useAllowRetrospectiveAccess} from 'src/hooks';

import SharePlaybook from './share_playbook';
import {
    BackstageSubheader,
    BackstageSubheaderDescription,
    TabContainer,
    StyledMarkdownTextbox,
    StyledSelect,
} from './styles';
import {Toggle} from './automation/toggle';

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

const SidebarBlock = styled.div`
    margin: 0 0 40px;
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
    ${RegularHeading}

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
    min-height: 100vh;
`;

const BackstageGroupToggleHeader = styled.div`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
    display: flex;
    flex-direction: row;
    align-items: center;
`;

interface Props {
    isNew: boolean;
    teamId?: string;
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
    {id: 'templates', name: <FormattedMessage defaultMessage='Templates'/>},
    {id: 'actions', name: <FormattedMessage defaultMessage='Actions'/>},
    {id: 'permissions', name: <FormattedMessage defaultMessage='Permissions'/>},
] as const;

const retrospectiveReminderOptions = [
    {value: 0, label: 'Once'},
    {value: 3600, label: '1hr'},
    {value: 14400, label: '4hr'},
    {value: 86400, label: '24hr'},
    {value: 604800, label: '7days'},
] as const;

// @ts-ignore
const WebappUtils = window.WebappUtils;

const PlaybookNavbar = styled(BackstageNavbar)`
    top: 80px;
`;

const PlaybookEdit = (props: Props) => {
    const dispatch = useDispatch();

    const {formatMessage} = useIntl();

    const currentUserId = useSelector(getCurrentUserId);

    const [playbook, setPlaybook] = useState<DraftPlaybookWithChecklist | PlaybookWithChecklist>({
        ...emptyPlaybook(),
        reminder_timer_default_seconds: 86400,
        team_id: props.teamId || '',
    });
    const [changesMade, setChangesMade] = useState(false);

    const [showTitleDescriptionModal, setShowTitleDescriptionModal] = useState(false);

    const urlParams = useParams<URLParams>();
    const location = useLocation();

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
                        team_id: props.teamId || '',
                    });
                    setChangesMade(true);
                }
                return;
            }

            if (urlParams.playbookId) {
                try {
                    const fetchedPlaybook = await clientFetchPlaybook(urlParams.playbookId);
                    if (fetchedPlaybook) {
                        fetchedPlaybook.member_ids ??= [currentUserId];
                        setPlaybook(fetchedPlaybook);
                    }
                    setFetchingState(FetchingStateType.fetched);
                } catch {
                    setFetchingState(FetchingStateType.notFound);
                }
            }
        };
        fetchData();
    }, [urlParams.playbookId, props.isNew, props.teamId]);

    useEffect(() => {
        const teamId = props.teamId || playbook.team_id;
        if (!teamId) {
            return;
        }

        dispatch(selectTeam(teamId));
        dispatch(fetchMyChannelsAndMembers(teamId));
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

    const handlePublicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPlaybook({
            ...playbook,
            create_public_playbook_run: e.target.value === 'public',
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

    const handleClearUsers = () => {
        setPlaybook({
            ...playbook,
            member_ids: [],
        });
        setChangesMade(true);
    };

    const handleAddUserInvited = (userId: string) => {
        if (!playbook.invited_user_ids.includes(userId)) {
            setPlaybook({
                ...playbook,
                invited_user_ids: [...playbook.invited_user_ids, userId],
            });
            setChangesMade(true);
        }
    };

    const handleRemoveUserInvited = (userId: string) => {
        const idx = playbook.invited_user_ids.indexOf(userId);
        setPlaybook({
            ...playbook,
            invited_user_ids: [...playbook.invited_user_ids.slice(0, idx), ...playbook.invited_user_ids.slice(idx + 1)],
        });
        setChangesMade(true);
    };

    const handleAssignDefaultOwner = (userId: string | undefined) => {
        if ((userId || userId === '') && playbook.default_owner_id !== userId) {
            setPlaybook({
                ...playbook,
                default_owner_id: userId,
            });
            setChangesMade(true);
        }
    };

    const handleBroadcastChannelSelected = (channelIds: string[]) => {
        // assumes no repeated elements on any of the arrays
        if (channelIds.length !== playbook.broadcast_channel_ids.length || channelIds.some((id) => !playbook.broadcast_channel_ids.includes(id))) {
            setPlaybook({
                ...playbook,
                broadcast_channel_ids: channelIds,
            });
            setChangesMade(true);
        }
    };

    const handleWebhookOnCreationChange = (urls: string) => {
        setPlaybook({
            ...playbook,
            webhook_on_creation_urls: urls.split('\n'),
        });
        setChangesMade(true);
    };

    const handleWebhookOnStatusUpdateChange = (urls: string) => {
        setPlaybook({
            ...playbook,
            webhook_on_status_update_urls: urls.split('\n'),
        });
        setChangesMade(true);
    };

    const handleMessageOnJoinChange = (message: string) => {
        if (playbook.message_on_join !== message) {
            setPlaybook({
                ...playbook,
                message_on_join: message,
            });
            setChangesMade(true);
        }
    };

    const handleToggleMessageOnJoin = () => {
        setPlaybook({
            ...playbook,
            message_on_join_enabled: !playbook.message_on_join_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleInviteUsers = () => {
        setPlaybook({
            ...playbook,
            invite_users_enabled: !playbook.invite_users_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleDefaultOwner = () => {
        setPlaybook({
            ...playbook,
            default_owner_enabled: !playbook.default_owner_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleBroadcastChannels = () => {
        setPlaybook({
            ...playbook,
            broadcast_enabled: !playbook.broadcast_enabled && playbook.status_update_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleWebhookOnCreation = () => {
        setPlaybook({
            ...playbook,
            webhook_on_creation_enabled: !playbook.webhook_on_creation_enabled,
        });
        setChangesMade(true);
    };

    const handleSignalAnyKeywordsChange = (keywords: string[]) => {
        setPlaybook({
            ...playbook,
            signal_any_keywords: [...keywords],
        });
        setChangesMade(true);
    };

    const handleToggleSignalAnyKeywords = () => {
        setPlaybook({
            ...playbook,
            signal_any_keywords_enabled: !playbook.signal_any_keywords_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleWebhookOnStatusUpdate = () => {
        setPlaybook({
            ...playbook,
            webhook_on_status_update_enabled: !playbook.webhook_on_status_update_enabled && playbook.status_update_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleCategorizePlaybookRun = () => {
        setPlaybook({
            ...playbook,
            categorize_channel_enabled: !playbook.categorize_channel_enabled,
        });
        setChangesMade(true);
    };

    const handleCategoryNameChange = (name: string) => {
        if (playbook.category_name !== name) {
            setPlaybook({
                ...playbook,
                category_name: name,
            });
            setChangesMade(true);
        }
    };

    const handleChannelNameTemplateChange = (channelNameTemplate: string) => {
        setPlaybook({
            ...playbook,
            channel_name_template: channelNameTemplate,
        });
        setChangesMade(true);
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
                            <TabContainer>
                                <SidebarBlock>
                                    <BackstageSubheader>
                                        {formatMessage({defaultMessage: 'Run Summary'})}
                                        <BackstageSubheaderDescription>
                                            {formatMessage({defaultMessage: 'This template helps to standardize the format for a concise description that explains each run to its stakeholders.'})}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <StyledMarkdownTextbox
                                        className={'playbook_description'}
                                        id={'playbook_description_edit'}
                                        placeholder={formatMessage({defaultMessage: 'Use Markdown to create a template.'})}
                                        value={playbook.run_summary_template}
                                        setValue={(run_summary_template: string) => {
                                            setPlaybook({
                                                ...playbook,
                                                run_summary_template,
                                            });
                                            setChangesMade(true);
                                        }}
                                    />
                                </SidebarBlock>
                                <SidebarBlock>
                                    <BackstageGroupToggleHeader id={'status-updates'}>
                                        <Toggle
                                            isChecked={playbook.status_update_enabled}
                                            onChange={() => {
                                                setPlaybook({
                                                    ...playbook,
                                                    status_update_enabled: !playbook.status_update_enabled,
                                                    webhook_on_status_update_enabled: playbook.webhook_on_status_update_enabled && !playbook.status_update_enabled,
                                                    broadcast_enabled: playbook.broadcast_enabled && !playbook.status_update_enabled,
                                                });
                                                setChangesMade(true);
                                            }}
                                        />
                                        {formatMessage({defaultMessage: 'Enable status updates'})}
                                    </BackstageGroupToggleHeader>
                                </SidebarBlock>
                                <SidebarBlock id={'default-update-timer'}>
                                    <DefaultUpdateTimer
                                        seconds={playbook.reminder_timer_default_seconds}
                                        setSeconds={(seconds: number) => {
                                            if (seconds !== playbook.reminder_timer_default_seconds &&
                                                seconds > 0) {
                                                setPlaybook({
                                                    ...playbook,
                                                    reminder_timer_default_seconds: seconds,
                                                });
                                            }
                                        }}
                                        disabled={!playbook.status_update_enabled}
                                    />
                                </SidebarBlock>
                                <SidebarBlock id={'status-update-text'}>
                                    <BackstageSubheader>
                                        {formatMessage({defaultMessage: 'Status updates'})}
                                        <BackstageSubheaderDescription>
                                            {formatMessage({defaultMessage: 'This template helps to standardize the format for recurring updates that take place throughout each run to keep.'})}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <StyledMarkdownTextbox
                                        className={'playbook_reminder_message'}
                                        id={'playbook_reminder_message_edit'}
                                        placeholder={formatMessage({defaultMessage: 'Use Markdown to create a template.'})}
                                        value={playbook.reminder_message_template}
                                        setValue={(value: string) => {
                                            setPlaybook({
                                                ...playbook,
                                                reminder_message_template: value,
                                            });
                                            setChangesMade(true);
                                        }}
                                        disabled={!playbook.status_update_enabled}
                                    />
                                </SidebarBlock>
                                {retrospectiveAccess &&
                                <>
                                    <SidebarBlock>
                                        <BackstageSubheader>
                                            {formatMessage({defaultMessage: 'Retrospective reminder interval'})}
                                            <BackstageSubheaderDescription>
                                                {formatMessage({defaultMessage: 'Reminds the channel at a specified interval to fill out the retrospective.'})}
                                            </BackstageSubheaderDescription>
                                        </BackstageSubheader>
                                        <StyledSelect
                                            value={retrospectiveReminderOptions.find((option) => option.value === playbook.retrospective_reminder_interval_seconds)}
                                            onChange={(option: { label: string, value: number }) => {
                                                setPlaybook({
                                                    ...playbook,
                                                    retrospective_reminder_interval_seconds: option ? option.value : option,
                                                });
                                                setChangesMade(true);
                                            }}
                                            options={retrospectiveReminderOptions}
                                            isClearable={false}
                                        />
                                    </SidebarBlock>
                                    <SidebarBlock>
                                        <BackstageSubheader>
                                            {formatMessage({defaultMessage: 'Retrospective template'})}
                                            <BackstageSubheaderDescription>
                                                {formatMessage({defaultMessage: 'Default text for the retrospective.'})}
                                            </BackstageSubheaderDescription>
                                        </BackstageSubheader>
                                        <StyledMarkdownTextbox
                                            className={'playbook_retrospective_template'}
                                            id={'playbook_retrospective_template_edit'}
                                            placeholder={formatMessage({defaultMessage: 'Enter retrospective template'})}
                                            value={playbook.retrospective_template}
                                            setValue={(value: string) => {
                                                setPlaybook({
                                                    ...playbook,
                                                    retrospective_template: value,
                                                });
                                                setChangesMade(true);
                                            }}
                                        />
                                    </SidebarBlock>
                                </>
                                }
                            </TabContainer>
                            <TabContainer>
                                <AutomationSettings
                                    searchProfiles={searchUsers}
                                    getProfiles={getUsers}
                                    userIds={playbook.invited_user_ids}
                                    inviteUsersEnabled={playbook.invite_users_enabled}
                                    onToggleInviteUsers={handleToggleInviteUsers}
                                    onAddUser={handleAddUserInvited}
                                    onRemoveUser={handleRemoveUserInvited}
                                    defaultOwnerEnabled={playbook.default_owner_enabled}
                                    defaultOwnerID={playbook.default_owner_id}
                                    onToggleDefaultOwner={handleToggleDefaultOwner}
                                    onAssignOwner={handleAssignDefaultOwner}
                                    broadcastChannelIds={playbook.broadcast_channel_ids}
                                    broadcastEnabled={playbook.broadcast_enabled}
                                    onToggleBroadcastChannel={handleToggleBroadcastChannels}
                                    onBroadcastChannelsSelected={handleBroadcastChannelSelected}
                                    webhookOnCreationEnabled={playbook.webhook_on_creation_enabled}
                                    onToggleWebhookOnCreation={handleToggleWebhookOnCreation}
                                    webhookOnCreationChange={handleWebhookOnCreationChange}
                                    webhookOnCreationURLs={playbook.webhook_on_creation_urls}
                                    webhookOnStatusUpdateEnabled={playbook.webhook_on_status_update_enabled}
                                    onToggleWebhookOnStatusUpdate={handleToggleWebhookOnStatusUpdate}
                                    webhookOnStatusUpdateURLs={playbook.webhook_on_status_update_urls}
                                    webhookOnStatusUpdateChange={handleWebhookOnStatusUpdateChange}
                                    messageOnJoinEnabled={playbook.message_on_join_enabled}
                                    onToggleMessageOnJoin={handleToggleMessageOnJoin}
                                    messageOnJoin={playbook.message_on_join}
                                    messageOnJoinChange={handleMessageOnJoinChange}
                                    signalAnyKeywordsEnabled={playbook.signal_any_keywords_enabled}
                                    onToggleSignalAnyKeywords={handleToggleSignalAnyKeywords}
                                    signalAnyKeywordsChange={handleSignalAnyKeywordsChange}
                                    signalAnyKeywords={playbook.signal_any_keywords}
                                    categorizePlaybookRun={playbook.categorize_channel_enabled}
                                    onToggleCategorizePlaybookRun={handleToggleCategorizePlaybookRun}
                                    categoryName={playbook.category_name}
                                    categoryNameChange={handleCategoryNameChange}
                                    statusUpdateEnabled={playbook.status_update_enabled}
                                    channelNameTemplate={playbook.channel_name_template}
                                    onChannelNameTemplateChange={handleChannelNameTemplateChange}
                                />
                            </TabContainer>
                            <TabContainer>
                                <SidebarBlock>
                                    <BackstageSubheader>
                                        {formatMessage({defaultMessage: 'Channel access'})}
                                        <BackstageSubheaderDescription>
                                            {formatMessage({defaultMessage: 'Determine the type of channel this playbook creates.'})}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <RadioContainer>
                                        <RadioLabel>
                                            <RadioInput
                                                type='radio'
                                                name='public'
                                                value={'public'}
                                                checked={playbook.create_public_playbook_run}
                                                onChange={handlePublicChange}
                                            />
                                            {formatMessage({defaultMessage: 'Public'})}
                                        </RadioLabel>
                                        <RadioLabel>
                                            <RadioInput
                                                type='radio'
                                                name='public'
                                                value={'private'}
                                                checked={!playbook.create_public_playbook_run}
                                                onChange={handlePublicChange}
                                            />
                                            {formatMessage({defaultMessage: 'Private'})}
                                        </RadioLabel>
                                    </RadioContainer>
                                </SidebarBlock>
                                <SidebarBlock>
                                    <SharePlaybook
                                        currentUserId={currentUserId}
                                        onAddUser={handleUsersInput}
                                        onRemoveUser={handleRemoveUser}
                                        searchProfiles={searchUsers}
                                        getProfiles={getUsers}
                                        memberIds={playbook.member_ids}
                                        onClear={handleClearUsers}
                                        teamId={props.teamId || playbook.team_id}
                                    />
                                </SidebarBlock>
                            </TabContainer>
                        </TabsContent>
                    </EditContent>
                </EditView>
            </Container>
            <RouteLeavingGuard
                navigate={(path) => WebappUtils.browserHistory.push(path)}
                shouldBlockNavigation={() => changesMade}
            />
        </OuterContainer>
    );
};

export default PlaybookEdit;
