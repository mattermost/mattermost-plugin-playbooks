// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {BookOutlineIcon, SortAscendingIcon, CheckIcon} from '@mattermost/compass-icons/components';
import Scrollbars from 'react-custom-scrollbars';

import {DateTime} from 'luxon';

import {debounce} from 'lodash';

import {useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import Profile from 'src/components/profile/profile';

import DotMenu, {DotMenuButton, DropdownMenuItem, TitleButton} from 'src/components/dot_menu';

import {SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';

import {RHSTitleRemoteRender} from 'src/rhs_title_remote_render';

import ClipboardChecklist from 'src/components/assets/illustrations/clipboard_checklist_svg';

import LoadingSpinner from 'src/components/assets/loading_spinner';
import {pluginId} from 'src/manifest';

import {getSiteUrl} from 'src/client';

import {UserList} from './rhs_participants';
import {RHSTitleText} from './rhs_title_common';

interface PlaybookToDisplay {
    title: string
}

interface RunToDisplay {
    id: string
    name: string
    participantIDs: string[]
    ownerUserID: string
    playbook: PlaybookToDisplay
    lastUpdatedAt: number
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
    onSelectRun: (runID: string) => void
    getMore: () => Promise<any>
    hasMore: boolean

    options: RunListOptions
    setOptions: React.Dispatch<React.SetStateAction<RunListOptions>>
    numInProgress: number
    numFinished: number
}

const getCurrentChannelName = (state: GlobalState) => getCurrentChannel(state).display_name;

const RHSRunList = (props: Props) => {
    const {formatMessage} = useIntl();
    const [loadingMore, setLoadingMore] = useState(false);
    const debouncedSetLoadingMore = debounce(setLoadingMore, 100);
    const getMore = async () => {
        debouncedSetLoadingMore(true);
        await props.getMore();
        debouncedSetLoadingMore(false);
    };
    const currentChannelName = useSelector<GlobalState, string>(getCurrentChannelName);

    const filterMenuTitleText = props.options.filter === FilterType.InProgress ? formatMessage({defaultMessage: 'Runs in progress'}) : formatMessage({defaultMessage: 'Finished runs'});

    const showNoRuns = props.runs.length === 0;

    return (
        <>
            <RHSTitleRemoteRender>
                <TitleContainer>
                    <ClipboardImage src={`${getSiteUrl()}/plugins/${pluginId}/public/app-bar-icon.png`}/>
                    <RHSTitleText>
                        {/* product name; don't translate */}
                        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                        {'Playbooks'}
                    </RHSTitleText>
                    <VerticalLine/>
                    <ChannelNameText>
                        {currentChannelName}
                    </ChannelNameText>
                </TitleContainer>
            </RHSTitleRemoteRender>
            <Container>
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
                            {formatMessage({defaultMessage: 'Runs in progress'})}
                            <FilterMenuNumericValue>
                                {props.numInProgress}
                            </FilterMenuNumericValue>
                        </FilterMenuItem>
                        <FilterMenuItem
                            onClick={() => props.setOptions((oldOptions) => ({...oldOptions, filter: FilterType.Finished}))}
                        >
                            {formatMessage({defaultMessage: 'Finished runs'})}
                            <FilterMenuNumericValue>
                                {props.numFinished}
                            </FilterMenuNumericValue>
                        </FilterMenuItem>
                    </DotMenu>
                    <Spacer/>
                    {/*<StartRunButton>
                        <PlayOutlineIcon size={14}/>
                        {formatMessage({defaultMessage: 'Start run'})}
                    </StartRunButton>*/}
                    <DotMenu
                        dotMenuButton={SortDotMenuButton}
                        placement='bottom-start'
                        icon={<SortAscendingIcon size={18}/>}
                    >
                        <SortMenuTitle>{formatMessage({defaultMessage: 'Sort runs by'})}</SortMenuTitle>
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
                {showNoRuns &&
                    <NoRuns
                        active={props.options.filter === FilterType.InProgress}
                        setOptions={props.setOptions}
                    />
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
                    </Scrollbars>
                }
            </Container>
        </>
    );
};

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
`;

const FilterMenuTitle = styled.div`
    font-family: Metropolis;
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
`;

const Spacer = styled.div`
    flex-grow: 1;
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

const StartRunButton = styled(SecondaryButton)`
    display: flex;
    flex-direction: row;
    gap: 6px;
    padding: 8px 16px;

    border: 0;
    height: 100%;
    font-weight: 600;
    font-size: 12px;
    color: var(--button-bg);
    background: rgba(var(--button-bg-rgb), 0.08);
`;

const SortDotMenuButton = styled(DotMenuButton)`
    justify-content: center;
    align-items: center;
`;

const SortMenuTitle = styled.div`
    color: rgba(var(--center-channel-text-rgb), 0.56);
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
    color: rgba(var(--center-channel-text-rgb), 0.56);
`;

const BlueCheckmark = styled(CheckIcon)`
    color: var(--button-bg);
    width: 18px;
    height: 18px;
`;

interface RHSRunListCardProps extends RunToDisplay {
    onClick: () => void
}

const RHSRunListCard = (props: RHSRunListCardProps) => {
    const {formatMessage} = useIntl();

    const participatIDsWithoutOwner = props.participantIDs.filter((id) => id !== props.ownerUserID);

    return (
        <CardContainer
            onClick={props.onClick}
        >
            <TitleRow>{props.name}</TitleRow>
            <PeopleRow>
                <OwnerProfileChip userId={props.ownerUserID}/>
                <ParticipantsProfiles>
                    <UserList
                        userIds={participatIDsWithoutOwner}
                        sizeInPx={20}
                    />
                </ParticipantsProfiles>
            </PeopleRow>
            <InfoRow>
                <LastUpdatedText>
                    {formatMessage(
                        {defaultMessage: 'Last updated {time}'},
                        {time: DateTime.fromMillis(props.lastUpdatedAt).toRelative()}
                    )}
                </LastUpdatedText>
                <PlaybookChip>
                    <StyledBookOutlineIcon
                        size={11}
                    />
                    {props.playbook.title}
                </PlaybookChip>
            </InfoRow>
        </CardContainer>
    );
};

const CardContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 16px 20px 20px;
    border: 1px solid rgba(var(--center-channel-text-rgb), 0.08);
    box-shadow: 0px 2px 3px 0px rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    gap: 8px;

    cursor: pointer;

    &:hover {
        box-shadow: 0px 4px 6px 0px rgba(0, 0, 0, 0.12);
    }

    &:active {
        box-shadow: inset 0px 2px 3px rgba(0, 0, 0, 0.08);
    }
`;
const TitleRow = styled.div`
    font-size: 14px;
    font-weight: 600;

    overflow: hidden;
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
    font-size: 11px;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-text-rgb), 0.64);
`;
const PlaybookChip = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0px 4px;
    gap: 4px;

    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    color: rgba(var(--center-channel-text-rgb), 0.72);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 40%;

    background: rgba(var(--center-channel-text-rgb), 0.08);
    border-radius: 4px;
`;
const OwnerProfileChip = styled(Profile)`
    flex-grow: 0;

    font-weight: 400;
    font-size: 11px;
    line-height: 15px;
    padding: 2px 10px 2px 2px;
    background: rgba(var(--center-channel-text-rgb), 0.08);
    border-radius: 12px;

    > .image {
        width: 16px;
        height: 16px;
    }
`;
const ParticipantsProfiles = styled.div`
    display: flex;
    flex-direction: row;
`;

const StyledBookOutlineIcon = styled(BookOutlineIcon)`
    flex-shrink: 0;
`;

interface NoRunsProps {
    active: boolean
    setOptions: React.Dispatch<React.SetStateAction<RunListOptions>>
}

const NoRuns = (props: NoRunsProps) => {
    const {formatMessage} = useIntl();

    let text = formatMessage({defaultMessage: 'There are no runs in progress linked to this channel'});
    if (!props.active) {
        text = formatMessage({defaultMessage: 'There are no finished runs linked to this channel'});
    }

    return (
        <NoActiveRunsContainer data-testid={'no-active-runs'}>
            <StyledClipboardChecklist/>
            <NoRunsText>
                {text}
            </NoRunsText>
            {props.active &&
                <ViewFinishedRunsButton
                    onClick={() => props.setOptions((oldOptions) => ({...oldOptions, filter: FilterType.Finished}))}
                >
                    {formatMessage({defaultMessage: 'View finished runs'})}
                </ViewFinishedRunsButton>
            }
        </NoActiveRunsContainer>
    );
};

const NoActiveRunsContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    align-self: center;
    gap: 24px;
    max-width: 325px;
    margin-top: 82px;
`;
const NoRunsText = styled.div`
    font-weight: 600;
    font-size: 20px;
    line-height: 28px;
    text-align: center;
`;
const ViewFinishedRunsButton = styled(TertiaryButton)`
    background: none;
`;
const StyledClipboardChecklist = styled(ClipboardChecklist)`
    width: 98px;
    height: 98px;
`;

export default RHSRunList;
