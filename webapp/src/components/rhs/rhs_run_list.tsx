// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {
    CheckAllIcon,
    CheckIcon,
    PlayOutlineIcon,
    PlusIcon,
    SortAscendingIcon,
} from '@mattermost/compass-icons/components';
import Scrollbars from 'react-custom-scrollbars';
import {debounce} from 'lodash';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannel, getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {useViewTelemetry} from 'src/hooks';
import {openPlaybookRunModal} from 'src/actions';
import DotMenu, {DotMenuButton, DropdownMenuItem, TitleButton} from 'src/components/dot_menu';
import {PrimaryButton, SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {RHSTitleRemoteRender} from 'src/rhs_title_remote_render';
import ClipboardChecklist from 'src/components/assets/illustrations/clipboard_checklist_svg';
import LoadingSpinner from 'src/components/assets/loading_spinner';
import PlaybooksProductIcon from 'src/components/assets/icons/playbooks_product_icon';
import {pluginId} from 'src/manifest';
import {getSiteUrl} from 'src/client';
import GiveFeedbackButton from 'src/components/give_feedback_button';
import {navigateToPluginUrl} from 'src/browser_routing';

import {GeneralViewTarget} from 'src/types/telemetry';

import {RHSTitleText} from 'src/components/rhs/rhs_title_common';
import {RHSRunListCard, RunToDisplay} from 'src/components/rhs/rhs_run_list_card';
import {IconWrapper, Spacer, StyledDropdownMenuItem} from 'src/components/rhs/styles';

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

const RHSRunList = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const currentChannelId = useSelector(getCurrentChannelId);
    const [loadingMore, setLoadingMore] = useState(false);
    const debouncedSetLoadingMore = useMemo(() => debounce(setLoadingMore, 100), [setLoadingMore]);
    const getMore = async () => {
        debouncedSetLoadingMore(true);
        await props.getMore();
        debouncedSetLoadingMore(false);
    };
    const currentChannelName = useSelector<GlobalState, string>(getCurrentChannelName);
    const filterMenuTitleText = props.options.filter === FilterType.InProgress ? formatMessage({defaultMessage: 'In progress'}) : formatMessage({defaultMessage: 'Finished'});
    const hasNoRuns = props.numFinished === 0 && props.numInProgress === 0;
    const showNoRuns = props.runs.length === 0;
    useViewTelemetry(GeneralViewTarget.ChannelsRHSRunList, currentChannelId);
    const handleStartRun = () => {
        dispatch(openPlaybookRunModal({
            onRunCreated: props.onRunCreated,
            triggerChannelId: currentChannelId,
            teamId: currentTeamId,
        }));
    };

    const handleCreateChannelChecklist = () => {
        // TODO implement
    };

    return (
        <>
            <RHSTitleRemoteRender>
                <TitleContainer>
                    <ClipboardImage src={`${getSiteUrl()}/plugins/${pluginId}/public/app-bar-icon.png`}/>
                    <RHSTitleText>
                        {/* product name; don't translate */}
                        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                        {'Checklists'}
                    </RHSTitleText>
                    <VerticalLine/>
                    <ChannelNameText>
                        {currentChannelName}
                    </ChannelNameText>
                </TitleContainer>
            </RHSTitleRemoteRender>
            <Container>
                {!hasNoRuns &&
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
                        <DotMenu
                            dotMenuButton={
                                CreateNewButton
                            }
                            placement={'bottom-end'}
                            icon={
                                <>
                                    <PlusIcon size={14}/>
                                    <FormattedMessage defaultMessage={'Create new'}/>
                                    <i className='icon icon-chevron-down'/>
                                </>
                            }
                        >
                            <RunTypeMenuContent
                                onRunClicked={handleStartRun}
                                onChannelChecklistClicked={handleCreateChannelChecklist}
                            />
                        </DotMenu>
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
                                onStartRunClicked={handleStartRun}
                                onCreateChecklistClicked={handleCreateChannelChecklist}
                            />
                        </NoRunsWrapper>
                        <Footer/>
                    </>
                }
                {!showNoRuns &&
                    <Scrollbars
                        autoHide={true}
                        autoHideTimeout={500}
                        autoHideDuration={500}
                        renderView={(rProps) => <ScrollbarsView {...rProps}/>}
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
                        <FeedbackWrapper>
                            <StyledGiveFeedbackButton tooltipPlacement='top'/>
                        </FeedbackWrapper>
                        <Footer/>
                    </Scrollbars>
                }
            </Container>
        </>
    );
};

const FeedbackWrapper = styled.div`
    padding: 16px;
    text-align: center;
    border-bottom: 1px solid rgba(var(--center-channel-text-rgb), 0.08);
`;

const ScrollbarsView = styled.div`
    display: flex;
    flex-direction: column;
`;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
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
    flex-direction: column;
    padding: 0px 16px;
    gap: 12px;
    flex-grow: 1;
`;
const NoRunsWrapper = styled.div`
    display: flex;
    flex-grow: 1;
`;

const FilterMenuTitle = styled.div`
    font-family: Metropolis;
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
`;

const StyledLoadingSpinner = styled(LoadingSpinner)`
    margin-top: 12px;
    width: 20px;
    height: 20px;
    align-self: center;
`;

const TitleContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
`;

const VerticalLine = styled.div`
    opacity: 0.16;
    border: 1px solid var(--center-channel-color);
    height: 24px;
`;

const ChannelNameText = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-weight: 400;
    font-size: 12px;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const ClipboardImage = styled.img`
    width: 24px;
    height: 24px;
    border-radius: 50%;
`;

const CreateNewButton = styled(SecondaryButton)`
    display: flex;
    flex-direction: row;
    gap: 6px;
    padding: 8px 16px;

    border: 0;
    height: 100%;
    font-weight: 600;
    font-size: 12px;
    color: var(--button-bg);
    background: rgba(var(--denim-button-bg-rgb), 0.08);



    & .icon {
        font-size: 14px;

        ::before{
            margin: 0;
        }
    }
`;

const SortDotMenuButton = styled(DotMenuButton)`
    justify-content: center;
    align-items: center;
`;

const SortMenuTitle = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    text-transform: uppercase;
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    margin: 5px 18px;
`;

const FilterMenuItem = styled(DropdownMenuItem)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    min-width: 182px;
`;

const StyledDropdownMenuSort = styled(DropdownMenuItem)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    min-width: 190px;
    align-items: center;
`;

const StyledGiveFeedbackButton = styled(GiveFeedbackButton)`
    && {
        font-size: 14px;
        color: rgba(var(--center-channel-text-rgb), 0.56);
        width: 100%;
    }

    &&:hover:not([disabled]) {
        color: var(--center-channel-color-72);
        background-color: rgba(var(--denim-button-bg-rgb), 0.08);
    }

`;

const RunTypeMenuContent = (props: {onRunClicked: () => void; onChannelChecklistClicked: () => void;}) => {
    return (<>
        <StyledDropdownMenuItem onClick={props.onChannelChecklistClicked}>
            <BrightIconWrapper>
                <CheckAllIcon size={18}/>
            </BrightIconWrapper>
            <FormattedMessage defaultMessage='Checklist'/>
        </StyledDropdownMenuItem>
        <StyledDropdownMenuItem onClick={props.onRunClicked}>
            <BrightIconWrapper>
                <PlayOutlineIcon size={18}/>
            </BrightIconWrapper>
            <FormattedMessage defaultMessage='Run from Playbook'/>
        </StyledDropdownMenuItem>
    </>);
};

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
    color: var(--button-bg);
    width: 18px;
    height: 18px;
`;

const BrightIconWrapper = styled(IconWrapper)`
    color: rgba(var(--center-channel-text-rgb), 0.56);
`;

interface NoRunsProps {
    active: boolean
    numInProgress: number;
    numFinished: number;
    onStartRunClicked: () => void;
    onCreateChecklistClicked: () => void;
    setOptions: React.Dispatch<React.SetStateAction<RunListOptions>>
}

const NoRuns = (props: NoRunsProps) => {
    const {formatMessage} = useIntl();

    const hasNoRuns = props.numInProgress === 0 && props.numFinished === 0;

    let text = formatMessage({defaultMessage: 'There are no in progress checklists or runs in this channel'});
    if (!props.active) {
        text = formatMessage({defaultMessage: 'There are no finished checklists or runs in this channel'});
    }
    if (hasNoRuns) {
        text = formatMessage({defaultMessage: 'Get started with a checklist for this channel'});
    }

    const navigateToPlaybooks = () => navigateToPluginUrl('/playbooks');

    return (
        <NoActiveRunsContainer data-testid={'no-active-runs'}>
            <StyledClipboardChecklist/>
            <NoRunsText>
                {text}
            </NoRunsText>
            {hasNoRuns &&
                <NoRunsPrimaryButton onClick={props.onCreateChecklistClicked}>
                    <StyledPlusIcon size={18}/>
                    <FormattedMessage defaultMessage={'Create a checklist'}/>
                </NoRunsPrimaryButton>
            }
            {!hasNoRuns &&
                <StyledDotMenu
                    dotMenuButton={
                        PrimaryButton
                    }
                    placement={'bottom'}
                    icon={
                        <>
                            <StyledPlusIcon size={18}/>
                            <FormattedMessage defaultMessage={'Create new'}/>
                            <i className='icon icon-chevron-down'/>
                        </>
                    }
                >
                    <RunTypeMenuContent
                        onRunClicked={props.onStartRunClicked}
                        onChannelChecklistClicked={props.onCreateChecklistClicked}
                    />
                </StyledDotMenu>
            }
            {hasNoRuns &&
                <ViewOtherRunsButton onClick={navigateToPlaybooks}>
                    {formatMessage({defaultMessage: 'Explore Playbooks'})}
                </ViewOtherRunsButton>
            }

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
    flex-direction: column;
    align-items: center;
    align-self: center;
    max-width: 325px;
    margin: auto;
`;
const NoRunsText = styled.div`
    font-weight: 600;
    font-size: 20px;
    line-height: 28px;
    text-align: center;
    margin-top: 30px;
`;

const NoRunsPrimaryButton = styled(PrimaryButton)`
    margin-top: 24px;
`;

const ViewOtherRunsButton = styled(TertiaryButton)`
    background: none;
    margin-top: 12px;
`;
const StyledClipboardChecklist = styled(ClipboardChecklist)`
    width: 140px;
    height: 140px;
`;

const StyledPlusIcon = styled(PlusIcon)`
    margin-right: 6px;
`;

const StyledDotMenu = styled(DotMenu)`
    margin-top: 24px;
`;

const Footer = () => {
    return (
        <StyledFooter>
            <FormattedMessage
                defaultMessage={'Powered by'}
            />
            <PlaybooksProductIcon/>
            {/* product name; don't translate */}
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
            {'Playbooks'}
        </StyledFooter>
    );
};

const StyledFooter = styled.div`
    text-transform: uppercase;
    text-align: center;
    padding: 20px 16px;
    font-weight: 600;
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    i {
        font-size: 14.4px;
        font-weight: 400;
        display: inline-block;

        &::before{
            margin: 0;
        }
    }
`;

export default RHSRunList;
