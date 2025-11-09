// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {
    BookOutlineIcon,
    CheckAllIcon,
    CheckIcon,
    LinkVariantIcon,
    PencilOutlineIcon,
    PlayOutlineIcon,
    PlusIcon,
    SortAscendingIcon,
} from '@mattermost/compass-icons/components';

import Scrollbars from 'react-custom-scrollbars';
import {DateTime} from 'luxon';
import {debounce} from 'lodash';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannel, getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import CheckLogoIcon from 'src/components/assets/app-bar-icon-check.svg';

import {useUpdateRun} from 'src/graphql/hooks';
import {createPlaybookRun} from 'src/client';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';
import {SemiBoldHeading} from 'src/styles/headings';
import {openPlaybookRunModal, openUpdateRunChannelModal, openUpdateRunNameModal} from 'src/actions';
import Profile from 'src/components/profile/profile';
import DotMenu, {DotMenuButton, DropdownMenuItem, TitleButton} from 'src/components/dot_menu';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {RHSTitleRemoteRender} from 'src/rhs_title_remote_render';
import ClipboardChecklist from 'src/components/assets/illustrations/clipboard_checklist_svg';
import LoadingSpinner from 'src/components/assets/loading_spinner';
import PlaybooksProductIcon from 'src/components/assets/icons/playbooks_product_icon';
import {navigateToPluginUrl} from 'src/browser_routing';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {PlaybookRunStatus} from 'src/types/playbook_run';

import {UserList} from './rhs_participants';

interface PlaybookToDisplay {
    title: string
}

interface RunToDisplay {
    id: string
    name: string
    participantIDs: string[]
    ownerUserID: string
    playbookID: string
    playbook?: Maybe<PlaybookToDisplay>
    numTasksClosed: number
    numTasks: number
    lastUpdatedAt: number
    type: string
    currentStatus: string
}

export enum FilterType {
    InProgress,
    Finished,
}

export interface RunListOptions {
    sort: string
    direction: string
    filter: FilterType
}

interface Props {
    runs: RunToDisplay[];
    onSelectRun: (runID: string) => void;
    onRunCreated: (runID: string, channelId: string, statsData: object) => void;
    onLinkRunToChannel: () => void;
    getMore: () => Promise<any>;
    hasMore: boolean;

    options: RunListOptions;
    setOptions: React.Dispatch<React.SetStateAction<RunListOptions>>;
    numInProgress: number;
    numFinished: number;
}

const getCurrentChannelName = (state: GlobalState) => getCurrentChannel(state)?.display_name;

const PoweredByPlaybooksFooter = () => (
    <PoweredByFooter>
        <PoweredByText>
            <FormattedMessage
                defaultMessage='POWERED BY{productName}'
                values={{
                    productName: (
                        <ProductName>
                            <PlaybooksProductIcon/>
                            {/* product name; don't translate */}
                            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                            {'PLAYBOOKS'}
                        </ProductName>
                    ),
                }}
            />
        </PoweredByText>
    </PoweredByFooter>
);

const RHSRunList = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const currentChannelId = useSelector(getCurrentChannelId);
    const currentUserId = useSelector(getCurrentUserId);
    const [loadingMore, setLoadingMore] = useState(false);
    const debouncedSetLoadingMore = useMemo(() => debounce(setLoadingMore, 100), [setLoadingMore]);
    const getMore = async () => {
        debouncedSetLoadingMore(true);
        await props.getMore();
        debouncedSetLoadingMore(false);
    };
    const currentChannelName = useSelector<GlobalState, string | undefined>(getCurrentChannelName);
    const filterMenuTitleText = props.options.filter === FilterType.InProgress ? formatMessage({defaultMessage: 'In progress'}) : formatMessage({defaultMessage: 'Finished'});
    const showNoRuns = props.runs.length === 0;

    const handleStartRun = () => {
        dispatch(openPlaybookRunModal({
            onRunCreated: props.onRunCreated,
            triggerChannelId: currentChannelId,
            teamId: currentTeamId,
        }));
    };

    const handleCreateBlankChecklist = async () => {
        try {
            const newRun = await createPlaybookRun(
                '', // No playbook ID for blank checklist
                currentUserId,
                currentTeamId,
                formatMessage({defaultMessage: 'Untitled checklist'}),
                '',
                currentChannelId,
                undefined
            );

            // Call the onRunCreated callback with the new run
            // Pass a flag to indicate we should auto-add a task
            props.onRunCreated(newRun.id, newRun.channel_id, {
                playbookId: '',
                channelMode: 'link_existing_channel',
                hasPlaybookChanged: false,
                hasNameChanged: false,
                hasSummaryChanged: false,
                hasChannelModeChanged: false,
                hasChannelIdChanged: false,
                autoAddTask: true,
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to create blank checklist:', error);
        }
    };

    const handleGoToPlaybooks = () => {
        navigateToPluginUrl('/playbooks');
    };

    return (
        <>
            <RHSTitleRemoteRender>
                <TitleContainer>
                    <TitleIcon src={CheckLogoIcon}/>
                    <>
                        {/* static title; don't translate */}
                        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                        {'Checklists'}
                    </>
                    <VerticalLine/>
                    <ChannelNameText>
                        {currentChannelName}
                    </ChannelNameText>
                </TitleContainer>
            </RHSTitleRemoteRender>
            <Container>
                {!showNoRuns &&
                <Header>
                    <DotMenu
                        dotMenuButton={TitleButton}
                        placement='bottom-start'
                        icon={
                            <FilterMenuTitle data-testid='rhs-runs-filter-menu'>
                                {filterMenuTitleText}
                                <i className={'icon icon-chevron-down'}/>
                            </FilterMenuTitle>
                        }
                    >
                        <FilterMenuItem
                            onClick={() => props.setOptions((oldOptions) => ({...oldOptions, filter: FilterType.InProgress}))}
                        >
                            {formatMessage({defaultMessage: 'In progress'})}
                            <FilterMenuNumericValue>
                                {props.numInProgress}
                            </FilterMenuNumericValue>
                        </FilterMenuItem>
                        <FilterMenuItem
                            onClick={() => props.setOptions((oldOptions) => ({...oldOptions, filter: FilterType.Finished}))}
                        >
                            {formatMessage({defaultMessage: 'Finished'})}
                            <FilterMenuNumericValue>
                                {props.numFinished}
                            </FilterMenuNumericValue>
                        </FilterMenuItem>
                    </DotMenu>
                    <Spacer/>
                    <SegmentedButtonContainer>
                        <PrimaryActionButton
                            onClick={handleCreateBlankChecklist}
                            data-testid='create-blank-checklist'
                        >
                            <PlusIcon size={18}/>
                            {formatMessage({defaultMessage: 'New checklist'})}
                        </PrimaryActionButton>
                        <DotMenu
                            dotMenuButton={DropdownTriggerButton}
                            placement='bottom-start'
                            icon={<i className={'icon icon-chevron-down'}/>}
                        >
                            <CreateChecklistMenuItem
                                onClick={handleStartRun}
                                data-testid='create-from-playbook'
                            >
                                <MenuItemIcon>
                                    <PlayOutlineIcon size={18}/>
                                </MenuItemIcon>
                                <FormattedMessage defaultMessage='Run a playbook'/>
                            </CreateChecklistMenuItem>
                            <Separator/>
                            <CreateChecklistMenuItem
                                onClick={handleGoToPlaybooks}
                                data-testid='go-to-playbooks'
                            >
                                <MenuItemIcon>
                                    <PlaybooksProductIcon/>
                                </MenuItemIcon>
                                <FormattedMessage defaultMessage='Go to Playbooks'/>
                            </CreateChecklistMenuItem>
                        </DotMenu>
                    </SegmentedButtonContainer>
                    <DotMenu
                        dotMenuButton={SortDotMenuButton}
                        placement='bottom-start'
                        icon={<SortAscendingIcon size={18}/>}
                    >
                        <SortMenuTitle>{formatMessage({defaultMessage: 'Sort by'})}</SortMenuTitle>
                        <SortMenuItem
                            label={formatMessage({defaultMessage: 'Recently created'})}
                            sortItem={'create_at'}
                            sortDirection={'DESC'}
                            options={props.options}
                            setOptions={props.setOptions}
                        />
                        <SortMenuItem
                            label={formatMessage({defaultMessage: 'Last status update'})}
                            sortItem={'last_status_update_at'}
                            sortDirection={'DESC'}
                            options={props.options}
                            setOptions={props.setOptions}
                        />
                        <SortMenuItem
                            label={formatMessage({defaultMessage: 'Alphabetically'})}
                            sortItem={'name'}
                            sortDirection={'ASC'}
                            options={props.options}
                            setOptions={props.setOptions}
                        />
                    </DotMenu>
                </Header>
                }
                {showNoRuns &&
                    <>
                        <NoRunsWrapper>
                            <NoRuns
                                active={props.options.filter === FilterType.InProgress}
                                numInProgress={props.numInProgress}
                                numFinished={props.numFinished}
                                setOptions={props.setOptions}
                                onCreateChecklistClicked={handleCreateBlankChecklist}
                            />
                        </NoRunsWrapper>
                        <PoweredByPlaybooksFooter/>
                    </>
                }
                {!showNoRuns &&
                    <Scrollbars
                        autoHide={true}
                        autoHideTimeout={500}
                        autoHideDuration={500}
                    >
                        <RunsList data-testid='rhs-runs-list'>
                            {props.runs.map((run: RunToDisplay) => (
                                <RHSRunListCard
                                    key={run.id}
                                    onLinkRunToChannel={props.onLinkRunToChannel}
                                    onClick={() => props.onSelectRun(run.id)}
                                    {...run}
                                />
                            ))}
                            {props.hasMore && !loadingMore &&
                                <TertiaryButton
                                    onClick={getMore}
                                >
                                    {formatMessage({defaultMessage: 'Show more'})}
                                </TertiaryButton>
                            }
                            {loadingMore &&
                                <StyledLoadingSpinner/>
                            }
                        </RunsList>
                        <PoweredByPlaybooksFooter/>
                    </Scrollbars>
                }
            </Container>
        </>
    );
};

const PoweredByFooter = styled.div`
    padding: 0 16px;
    margin-top: 10px;
    margin-bottom: 30px;
    text-align: center;
`;

const PoweredByText = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    line-height: 16px;
`;

const ProductName = styled.span`
    display: inline-flex;
    align-items: center;

    i {
        font-size: 16px;
    }
`;

const Container = styled.div`
    display: flex;
    height: 100%;
    flex-direction: column;
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 12px 16px;
    gap: 4px;
`;

const RunsList = styled.div`
    display: flex;
    min-height: calc(100% - 65px);
    flex-direction: column;
    padding: 0 16px;
    gap: 12px;
`;
const NoRunsWrapper = styled.div`
    display: flex;
    min-height: calc(100% - 123px);
`;

const FilterMenuTitle = styled.div`
    font-family: Metropolis;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
`;

const Spacer = styled.div`
    flex-grow: 1;
`;

const StyledLoadingSpinner = styled(LoadingSpinner)`
    width: 20px;
    height: 20px;
    align-self: center;
    margin-top: 12px;
`;

const TitleContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
`;

const VerticalLine = styled.div`
    height: 24px;
    border-left: 1px solid var(--center-channel-color);
    opacity: 0.16;
`;

const ChannelNameText = styled.div`
    overflow: hidden;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-family: "Open Sans", sans-serif;
    font-size: 12px;
    font-weight: 400;
    line-height: 20px;
    text-overflow: ellipsis;
`;

const TitleIcon = styled.img`
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(var(--button-bg-rgb), 0.08);
    color: var(--button-bg);
`;

const SegmentedButtonContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 32px;
    border-radius: 4px;
`;

const PrimaryActionButton = styled.button`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 12px;
    border: 0;
    background: rgba(var(--button-bg-rgb), 0.08);
    color: var(--button-bg);
    font-size: 12px;
    font-weight: 600;
    gap: 4px;
    border-top-left-radius: 4px;
    border-bottom-left-radius: 4px;
    border-right: 1px solid rgba(var(--button-bg-rgb), 0.16);
    cursor: pointer;
    height: 100%;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.12);
    }

    &:active {
        background: rgba(var(--button-bg-rgb), 0.16);
    }
`;

const DropdownTriggerButton = styled(TitleButton)`
    && {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px 2px;
        width: 24px;
        height: 100%;
        border-radius: 0 4px 4px 0;
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
        font-size: 12px;

        &:hover {
            background: rgba(var(--button-bg-rgb), 0.12);
        }

        &:active {
            background: rgba(var(--button-bg-rgb), 0.16);
        }

        i {
            font-size: 18px;
        }
    }
`;

const CreateChecklistMenuItem = styled(DropdownMenuItem)`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    min-height: 40px;
`;

const MenuItemIcon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    flex-shrink: 0;
    width: 24px;

    i {
        font-size: 18px;
    }
`;

const SortDotMenuButton = styled(DotMenuButton)`
    align-items: center;
    justify-content: center;
`;

const SortMenuTitle = styled.div`
    margin: 5px 18px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    text-transform: uppercase;
`;

const FilterMenuItem = styled(DropdownMenuItem)`
    display: flex;
    min-width: 182px;
    flex-direction: row;
    justify-content: space-between;
`;

const StyledDropdownMenuSort = styled(DropdownMenuItem)`
    display: flex;
    min-width: 190px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
`;

interface SortMenuItemProps {
    label: string
    sortItem: string
    sortDirection: string
    options: RunListOptions
    setOptions: React.Dispatch<React.SetStateAction<RunListOptions>>
}

const SortMenuItem = (props: SortMenuItemProps) => {
    return (
        <StyledDropdownMenuSort
            onClick={() => props.setOptions((oldOptions) => ({...oldOptions, sort: props.sortItem, direction: props.sortDirection}))}
        >
            {props.label}
            {props.sortItem === props.options.sort &&
                <BlueCheckmark/>
            }
        </StyledDropdownMenuSort>
    );
};

const FilterMenuNumericValue = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const BlueCheckmark = styled(CheckIcon)`
    width: 18px;
    height: 18px;
    color: var(--button-bg);
`;

interface RHSRunListCardProps extends RunToDisplay {
    onClick: () => void;
    onLinkRunToChannel: () => void;
}

const RHSRunListCard = (props: RHSRunListCardProps) => {
    const {formatMessage} = useIntl();
    const [removed, setRemoved] = useState(false);
    const {add: addToastMessage} = useToaster();
    const teamId = useSelector(getCurrentTeamId);
    const currentUserId = useSelector(getCurrentUserId);
    const canEditRun = (currentUserId === props.ownerUserID || props.participantIDs.includes(currentUserId)) && props.currentStatus === PlaybookRunStatus.InProgress;
    const participatIDsWithoutOwner = props.participantIDs.filter((id) => id !== props.ownerUserID);
    const [movedChannel, setMovedChannel] = useState({channelId: '', channelName: ''});
    const updateRun = useUpdateRun(props.id);
    const isPlaybookRun = props.type === PlaybookRunType.Playbook;
    const icon = isPlaybookRun ? <PlayOutlineIcon size={22}/> : <CheckAllIcon size={22}/>;

    return (
        <CardWrapper
            progress={(props.numTasksClosed / props.numTasks) * 100}
            className={removed ? 'removed' : ''}
            onAnimationEnd={() => {
                if (!movedChannel.channelId) {
                    return;
                }
                updateRun({channelID: movedChannel.channelId});
                addToastMessage({
                    content: isPlaybookRun ? formatMessage({defaultMessage: 'Run moved to {channel}'}, {channel: movedChannel.channelName}) : formatMessage({defaultMessage: 'Checklist moved to {channel}'}, {channel: movedChannel.channelName}),
                    toastStyle: ToastStyle.Success,
                });
                props.onLinkRunToChannel();
            }}
        >
            <CardContainer
                onClick={props.onClick}
                data-testid='run-list-card'
            >
                <CardTitleContainer>
                    <IconWrapper $margin='6px'>
                        {icon}
                    </IconWrapper>
                    <TitleRow>{props.name}</TitleRow>
                    <Spacer/>
                    {isPlaybookRun &&
                        <ContextMenu
                            playbookID={props.playbookID}
                            playbookTitle={props.playbook?.title || ''}
                            playbookRunID={props.id}
                            teamID={teamId}
                            canSeePlaybook={Boolean(props.playbook?.title)}
                            canEditRun={canEditRun}
                            onUpdateName={(newName) => {
                                updateRun({name: newName});
                            }}
                            onUpdateChannel={(newChannelId: string, newChannelName: string) => {
                                setRemoved(true);
                                setMovedChannel({
                                    channelId: newChannelId,
                                    channelName: newChannelName,
                                });
                            }}
                        />
                    }
                    {!isPlaybookRun &&
                        <ChannelChecklistContextMenu
                            playbookRunID={props.id}
                            teamID={teamId}
                            canEditRun={canEditRun}
                            onUpdateName={(newName) => {
                                updateRun({name: newName});
                            }}
                            onUpdateChannel={(newChannelId: string, newChannelName: string) => {
                                setRemoved(true);
                                setMovedChannel({
                                    channelId: newChannelId,
                                    channelName: newChannelName,
                                });
                            }}
                        />
                    }
                </CardTitleContainer>
                {isPlaybookRun &&
                    <PeopleRow>
                        <OwnerProfileChip userId={props.ownerUserID}/>
                        <ParticipantsProfiles>
                            <UserList
                                userIds={participatIDsWithoutOwner}
                                sizeInPx={20}
                            />
                        </ParticipantsProfiles>
                    </PeopleRow>
                }
                {!isPlaybookRun && props.numTasks > 0 &&
                    <TasksDone>
                        <TasksDoneNumbers>
                            {/* eslint-disable formatjs/no-literal-string-in-jsx */}
                            {props.numTasksClosed + '/' + props.numTasks}
                        </TasksDoneNumbers>
                        <TasksDoneText>
                            {formatMessage({defaultMessage: 'tasks done'})}
                        </TasksDoneText>
                    </TasksDone>
                }
                <InfoRow>
                    <LastUpdatedText>
                        {formatMessage(
                            {defaultMessage: 'Last updated {time}'},
                            {time: DateTime.fromMillis(props.lastUpdatedAt).toRelative()}
                        )}
                    </LastUpdatedText>
                    {props.playbook && isPlaybookRun &&
                        <PlaybookChip>
                            <StyledBookOutlineIcon
                                size={11}
                            />
                            <PlaybookChipText>{props.playbook.title}</PlaybookChipText>
                        </PlaybookChip>
                    }
                </InfoRow>
            </CardContainer>
        </CardWrapper>
    );
};
const CardWrapper = styled.div<{ progress: number }>`
    position: relative;
    padding:0;
    border-radius: 4px;
    margin: 0;

    &::after {
        position: absolute;
        right: calc(${({progress}) => 100 - progress}% + 1px);
        bottom: 1px;
        left: 1px;
        display: block;
        border-bottom: 2px solid var(--online-indicator);
        border-bottom-left-radius: inherit;
        border-bottom-right-radius: ${({progress}) => (progress < 100 ? 0 : 'inherit')};
        content: ''
    }

    &.removed {
        animation: disapear 0.7s;
        animation-fill-mode: forwards;
    }

    @keyframes disapear{
        35% {
            transform: translateY(5%);
        }

        100% {
            transform: translateY(-1000%);
        }
    }

    @keyframes disapear{
        35% {
            transform: translateY(5%);
        }

        100% {
            transform: translateY(-1000%);
        }
    }
`;

const CardContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 16px 20px 20px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    box-shadow: 0 2px 3px 0 rgba(0 0 0 / 0.08);
    cursor: pointer;
    gap: 8px;

    &:hover {
        box-shadow: 0 4px 6px 0 rgba(0 0 0 / 0.12);
    }

    &:active {
        box-shadow: inset 0 2px 3px rgba(0 0 0 / 0.08);
    }
`;
const CardTitleContainer = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;

`;
const TitleRow = styled.div`
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
`;
const PeopleRow = styled.div`
    display: flex;
    flex-direction: row;
    gap: 4px;
`;
const InfoRow = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
`;
const LastUpdatedText = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 11px;
    font-weight: 400;
    line-height: 16px;
`;
const PlaybookChip = styled.div`
    display: flex;
    max-width: 40%;
    flex-direction: row;
    align-items: center;
    padding: 0 4px;
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    gap: 4px;
`;
const PlaybookChipText = styled.span`
    overflow: hidden;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const OwnerProfileChip = styled(Profile)`
    flex-grow: 0;
    padding: 2px 10px 2px 2px;
    border-radius: 12px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    font-size: 11px;
    font-weight: 400;
    line-height: 15px;

    > .image {
        width: 16px;
        height: 16px;
    }
`;
const ParticipantsProfiles = styled.div`
    display: flex;
    flex-direction: row;
`;

const ThreeDotsIcon = styled(HamburgerButton)`
    margin-left: 1px;
    font-size: 18px;
`;

const StyledBookOutlineIcon = styled(BookOutlineIcon)`
    flex-shrink: 0;
`;

const StyledDotMenuButton = styled(DotMenuButton)`
    width: 28px;
    height: 28px;
`;

const StyledDropdownMenuItem = styled(DropdownMenuItem)`
    display: flex;
    align-content: center;
`;

const Separator = styled.hr`
    display: flex;
    width: 100%;
    align-content: center;
    border-top: 1px solid var(--center-channel-color-08);
    margin: 5px auto;
`;

const IconWrapper = styled.div<{$margin?: string}>`
    margin-right: ${({$margin}) => ($margin || '11px')};
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

interface NoRunsProps {
    active: boolean
    numInProgress: number;
    numFinished: number;
    onCreateChecklistClicked: () => void;
    setOptions: React.Dispatch<React.SetStateAction<RunListOptions>>
}

const NoRuns = (props: NoRunsProps) => {
    const {formatMessage} = useIntl();

    let text = formatMessage({defaultMessage: 'Get started with a checklist for this channel'});

    if (props.active && props.numFinished > 0) {
        text = formatMessage({defaultMessage: 'There are no in progress checklists in this channel'});
    } else if (!props.active) {
        text = formatMessage({defaultMessage: 'There are no finished checklists linked to this channel'});
    }

    return (
        <NoActiveRunsContainer data-testid={'no-active-runs'}>
            <StyledClipboardChecklist/>
            <NoRunsText>
                {text}
            </NoRunsText>
            <PrimaryButton 
                onClick={props.onCreateChecklistClicked}
                data-testid='create-blank-checklist'
            >
                <PlusIcon size={18}/>
                <FormattedMessage defaultMessage={'New checklist'}/>
            </PrimaryButton>
            {props.active && props.numFinished > 0 &&
                <ViewOtherRunsButton
                    onClick={() => props.setOptions((oldOptions) => ({...oldOptions, filter: FilterType.Finished}))}
                >
                    {formatMessage({defaultMessage: 'View finished'})}
                </ViewOtherRunsButton>
            }
            {!props.active && props.numInProgress > 0 &&
                <ViewOtherRunsButton
                    onClick={() => props.setOptions((oldOptions) => ({...oldOptions, filter: FilterType.InProgress}))}
                >
                    {formatMessage({defaultMessage: 'View in progress'})}
                </ViewOtherRunsButton>
            }
        </NoActiveRunsContainer>
    );
};

const NoActiveRunsContainer = styled.div`
    display: flex;
    max-width: 325px;
    flex-direction: column;
    align-items: center;
    align-self: center;
    margin: auto;
    gap: 24px;
`;
const NoRunsText = styled.div`
    ${SemiBoldHeading}
    font-size: 20px;
    line-height: 28px;
    text-align: center;
`;
const ViewOtherRunsButton = styled(TertiaryButton)`
    background: none;
`;
const StyledClipboardChecklist = styled(ClipboardChecklist)`
    width: 189.33px;
    height: 106.67px;
`;

interface ContextMenuProps {
    playbookID: string;
    teamID: string;
    playbookRunID: string;
    playbookTitle: string;
    canSeePlaybook: boolean;
    canEditRun: boolean;
    onUpdateChannel: (channelId: string, channelName: string) => void;
    onUpdateName: (name: string) => void;
}
const ContextMenu = (props: ContextMenuProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const overviewURL = `/runs/${props.playbookRunID}?from=channel_rhs_dotmenu`;
    const playbookURL = `/playbooks/${props.playbookID}`;

    return (
        <DotMenu
            dotMenuButton={StyledDotMenuButton}
            placement='bottom-start'
            icon={<ThreeDotsIcon/>}
        >
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunChannelModal(props.playbookRunID, props.teamID, PlaybookRunType.Playbook, props.onUpdateChannel))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this'})}
            >
                <IconWrapper>
                    <LinkVariantIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Link to a different channel'/>
            </StyledDropdownMenuItem>
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunNameModal(props.playbookRunID, props.onUpdateName))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this'})}
            >
                <IconWrapper>
                    <PencilOutlineIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Rename'/>
            </StyledDropdownMenuItem>
            <Separator/>
            <StyledDropdownMenuItem onClick={() => navigateToPluginUrl(overviewURL)}>
                <IconWrapper>
                    <PlayOutlineIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Go to overview'/>
            </StyledDropdownMenuItem>
            {props.playbookID && props.canSeePlaybook && (
                <StyledDropdownMenuItem onClick={() => navigateToPluginUrl(playbookURL)}>
                    <RowContainer>
                        <ColContainer>
                            <IconWrapper>
                                <BookOutlineIcon size={22}/>
                            </IconWrapper>
                            <FormattedMessage defaultMessage='Go to playbook'/>
                        </ColContainer>
                        <MenuItemSubTitle>{props.playbookTitle}</MenuItemSubTitle>
                    </RowContainer>
                </StyledDropdownMenuItem>
            )}
        </DotMenu>
    );
};

interface ChannelChecklistContextMenuProps {
    teamID: string;
    playbookRunID: string;
    canEditRun: boolean;
    onUpdateChannel: (channelId: string, channelName: string) => void;
    onUpdateName: (name: string) => void;
}
const ChannelChecklistContextMenu = (props: ChannelChecklistContextMenuProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    return (
        <DotMenu
            dotMenuButton={StyledDotMenuButton}
            placement='bottom-start'
            icon={<ThreeDotsIcon/>}
        >
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunChannelModal(props.playbookRunID, props.teamID, PlaybookRunType.ChannelChecklist, props.onUpdateChannel))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this checklist'})}
            >
                <IconWrapper>
                    <LinkVariantIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Link checklist to a different channel'/>
            </StyledDropdownMenuItem>
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunNameModal(props.playbookRunID, props.onUpdateName))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this checklist'})}
            >
                <IconWrapper>
                    <PencilOutlineIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Rename checklist'/>
            </StyledDropdownMenuItem>
        </DotMenu>
    );
};

const ColContainer = styled.div`
    display: flex;
    flex-direction: row;
`;

const RowContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const MenuItemSubTitle = styled.div`
    overflow: hidden;

    /* don't let the playbook title make context menu grow too wide */
    max-width: 220px;
    margin-left: 33px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const TasksDone = styled.div`
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 11px;
`;

const TasksDoneNumbers = styled.div`
    margin-right: 6px;
    font-weight: 600;
`;

const TasksDoneText = styled.div`
    font-weight: 400;
`;

export default RHSRunList;
