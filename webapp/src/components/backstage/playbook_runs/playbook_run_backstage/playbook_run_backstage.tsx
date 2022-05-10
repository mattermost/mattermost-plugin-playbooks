// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';
import {Redirect, Route, useRouteMatch, Link, NavLink, Switch, useHistory} from 'react-router-dom';
import {useIntl} from 'react-intl';

import MdiIcon from '@mdi/react';
import {mdiLightningBoltOutline} from '@mdi/js';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import Following from 'src/components/backstage/playbook_runs/playbook_run_backstage/following';

import CopyLink from 'src/components/widgets/copy_link';

import {
    Badge,
    ExpandRight,
    Icon16,
    PrimaryButtonLarger,
    SecondaryButtonLarger,
} from 'src/components/backstage/playbook_runs/shared';

import {PlaybookRun, Metadata as PlaybookRunMetadata, RunMetricData} from 'src/types/playbook_run';
import {Overview} from 'src/components/backstage/playbook_runs/playbook_run_backstage/overview/overview';
import {Retrospective} from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/retrospective';
import {
    clientFetchPlaybook,
    clientRemoveTimelineEvent,
    fetchPlaybookRun,
    fetchPlaybookRunMetadata,
    followPlaybookRun,
    unfollowPlaybookRun,
    getSiteUrl,
} from 'src/client';
import {pluginUrl, pluginErrorUrl} from 'src/browser_routing';
import {ErrorPageTypes} from 'src/constants';
import {useAllowRetrospectiveAccess, useForceDocumentTitle, useRun} from 'src/hooks';
import {RegularHeading} from 'src/styles/headings';
import UpgradeBadge from 'src/components/backstage/upgrade_badge';
import PlaybookIcon from 'src/components/assets/icons/playbook_icon';
import {PlaybookWithChecklist} from 'src/types/playbook';
import ExportLink from '../playbook_run_details/export_link';
import {BadgeType} from 'src/components/backstage/status_badge';
import Tooltip from 'src/components/widgets/tooltip';
import RunActionsModal from 'src/components/run_actions_modal';

import {showRunActionsModal} from 'src/actions';

declare module 'react-bootstrap/esm/OverlayTrigger' {
    interface OverlayTriggerProps {
        shouldUpdatePosition?: boolean;
    }
}

const OuterContainer = styled.div`
    background: var(center-channel-bg);
    display: flex;
    flex-direction: column;
    height: 100%;
`;

const TopContainer = styled.div`
    position: sticky;
    z-index: 2;
    top: 0;
    background: var(--center-channel-bg);
    width: 100%;
`;

const FirstRow = styled.div`
    display: flex;
    align-items: center;
    height: 60px;
    margin: 0 32px;
    padding-top: 24px;
`;

const SecondRow = styled.div`
    display: flex;
    height: 60px;
    margin: 0;
    padding: 10px 0 0 80px;
    box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
`;

const BottomContainer = styled.div`
    flex-grow: 1;
    background: rgba(var(--center-channel-color-rgb), 0.03);
    width: 100%;
`;

const InnerContainer = styled.div`
    padding: 20px;
    padding-top: 40px;
    max-width: 1120px;
    margin: 0 auto;
    height: 100%;
    font-family: 'Open Sans', sans-serif;
    font-style: normal;
    font-weight: 600;
`;

const Icon = styled.button`
    display: block;
    padding: 0;
    border: none;
    background: transparent;
    line-height: 24px;
    cursor: pointer;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const LeftArrow = styled(Icon)`
    font-size: 24px;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }
`;

export const HeaderIcon = styled(Icon)<{clicked: boolean}>`
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    font-size: 18px;
    margin-left: 8px;
    border-radius: 4px;
    ${({clicked}) => !clicked && css`
        &:hover {
            background: var(--center-channel-color-08);
            color: var(--center-channel-color-72);
        }
    `}
    ${({clicked}) => clicked && css`
        background: var(--button-bg-08);
        color: var(--button-bg);
    `}
`;

const StyledCopyLink = styled(CopyLink)`
    border-radius: 4px;
    font-size: 16px;
    width: 28px;
    height: 28px;
    line-height: 18px;
    margin-left: 8px;
    display: grid;
    place-items: center;
`;

const VerticalBlock = styled.div`
    display: flex;
    flex-direction: column;
    font-weight: 400;
    padding: 0 16px 0 24px;
`;

const Title = styled.div`
    ${RegularHeading} {
    }

    font-size: 20px;
    color: var(--center-channel-color);
`;

const PlaybookLink = styled(Link)`
    display: flex;
    flex-direction: row;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    cursor: pointer;

    &:hover {
        color: var(--button-bg);
    }
`;

const SmallPlaybookIcon = styled(PlaybookIcon)`
    height: 13px;
    width: auto;
    margin-top: 1px;
`;

const SubTitle = styled.div`
    font-size: 11px;
    line-height: 16px;
    margin-left: 4px;
`;

const TabItem = styled(NavLink)`
    && {
        line-height: 32px;
        padding: 10px 20px 0 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: unset;
        color: unset;

        &.active {
            box-shadow: inset 0px -2px 0px var(--button-bg);
            color: var(--button-bg);
        }
    }
`;

const TitleWithBadgeAndLink = styled.div`
    display: flex;
    flex-direction: row;
`;

const StyledBadge = styled(Badge)`
    margin-left: 8px;
`;

interface MatchParams {
    playbookRunId: string
}

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const PositionedUpgradeBadge = styled(UpgradeBadge)`
    margin-left: 8px;
    vertical-align: sub;
`;

const Line = styled.hr`
    border: 1px solid;
    margin: 0px 0px 0px 12px;
    height: 32px;
`;

const Button = styled(SecondaryButtonLarger)`
    margin-left: 12px;
`;

const FollowingButton = styled(Button)`
    background: rgba(var(--button-bg-rgb), 0.12);
    &&:hover {
        background: rgba(var(--button-bg-rgb), 0.24);
    }
`;

const PlaybookRunBackstage = () => {
    const dispatch = useDispatch();
    const [playbookRun, setPlaybookRun] = useState<PlaybookRun | null>(null);
    const [playbookRunMetadata, setPlaybookRunMetadata] = useState<PlaybookRunMetadata | null>(null);
    const [playbook, setPlaybook] = useState<PlaybookWithChecklist | null>(null);
    const {formatMessage} = useIntl();
    const match = useRouteMatch<MatchParams>();
    const history = useHistory();
    const currentUserID = useSelector(getCurrentUserId);
    const currentRun = useRun(match.params.playbookRunId);

    const [following, setFollowing] = useState<string[]>([]);

    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);

    const allowRetrospectiveAccess = useAllowRetrospectiveAccess();

    useForceDocumentTitle(playbookRun?.name ? (playbookRun.name + ' - Playbooks') : 'Playbooks');

    useEffect(() => {
        const playbookRunId = match.params.playbookRunId;

        if (currentRun) {
            setPlaybookRun(currentRun);
        } else {
            Promise.all([fetchPlaybookRun(playbookRunId), fetchPlaybookRunMetadata(playbookRunId)]).then(([playbookRunResult, playbookRunMetadataResult]) => {
                setPlaybookRun(playbookRunResult);
                if (playbookRunMetadataResult) {
                    setPlaybookRunMetadata(playbookRunMetadataResult);
                }
                setFetchingState(FetchingStateType.fetched);
                setFollowing(playbookRunMetadataResult && playbookRunMetadataResult.followers ? playbookRunMetadataResult.followers : []);
            }).catch(() => {
                setFetchingState(FetchingStateType.notFound);
            });
        }
    }, [match.params.playbookRunId, currentRun]);

    useEffect(() => {
        const fetchData = async () => {
            if (playbookRun?.playbook_id) {
                const fetchedPlaybook = await clientFetchPlaybook(playbookRun.playbook_id);
                setPlaybook(fetchedPlaybook!);
            }
        };

        fetchData();
    }, [playbookRun?.playbook_id]);

    const deleteTimelineEvent = async (id: string) => {
        if (!playbookRun) {
            return;
        }

        await clientRemoveTimelineEvent(playbookRun.id, id);
        setPlaybookRun({
            ...playbookRun,
            timeline_events: playbookRun.timeline_events.filter((event) => event.id !== id),
        });
    };

    const setRetrospective = (retrospective: string) => {
        setPlaybookRun((run) => ({
            ...run,
            retrospective,
        } as PlaybookRun));
    };

    const setMetricsData = (metrics_data: RunMetricData[]) => {
        setPlaybookRun((run) => ({
            ...run,
            metrics_data,
        } as PlaybookRun));
    };

    const setPublishedAt = (retrospective_published_at: number) => {
        setPlaybookRun((run) => ({
            ...run,
            retrospective_published_at,
        } as PlaybookRun));
    };

    const setCanceled = (retrospective_was_canceled: boolean) => {
        setPlaybookRun((run) => ({
            ...run,
            retrospective_was_canceled,
        } as PlaybookRun));
    };

    if (fetchingState === FetchingStateType.loading) {
        return null;
    }

    if (fetchingState === FetchingStateType.notFound || playbookRun === null || playbookRunMetadata === null) {
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOK_RUNS)}/>;
    }

    const onFollow = () => {
        if (following.includes(currentUserID)) {
            return;
        }
        followPlaybookRun(playbookRun.id);
        const followingCopy = [...following, currentUserID];
        setFollowing(followingCopy);
    };

    const onUnfollow = () => {
        unfollowPlaybookRun(playbookRun.id);
        const followingCopy = following.filter((item) => item !== currentUserID);
        setFollowing(followingCopy);
    };

    const closePlaybookRunDetails = () => {
        history.goBack();
    };

    let followButton = (<Button onClick={onFollow}>{formatMessage({defaultMessage: 'Follow'})}</Button>);
    if (following.includes(currentUserID)) {
        followButton = (<FollowingButton onClick={onUnfollow}>{formatMessage({defaultMessage: 'Following'})}</FollowingButton>);
    }

    const runActionsButton = (
        <Tooltip
            id={'run-actions-button-tooltip'}
            placement={'bottom'}
            shouldUpdatePosition={true}
            content={formatMessage({defaultMessage: 'Run Actions'})}
        >
            <HeaderIcon
                onClick={() => dispatch(showRunActionsModal())}
                clicked={false}
                aria-label={formatMessage({defaultMessage: 'Run Actions'})}
            >
                <MdiIcon
                    path={mdiLightningBoltOutline}
                    size={'16px'}
                />
            </HeaderIcon>
        </Tooltip>
    );

    return (
        <OuterContainer>
            <TopContainer>
                <FirstRow>
                    <LeftArrow
                        className='icon-arrow-left'
                        onClick={closePlaybookRunDetails}
                    />
                    <VerticalBlock>
                        <TitleWithBadgeAndLink>
                            <Title data-testid='playbook-run-title'>{playbookRun.name}</Title>
                            <StyledBadge status={BadgeType[playbookRun.current_status]}/>
                            {runActionsButton}
                            <StyledCopyLink
                                id='copy-run-link-tooltip'
                                to={getSiteUrl() + '/playbooks/runs/' + playbookRun.id}
                                tooltipMessage={formatMessage({defaultMessage: 'Copy link to run'})}
                            />
                        </TitleWithBadgeAndLink>
                        {
                            playbook &&
                            <PlaybookLink to={pluginUrl(`/playbooks/${playbook?.id}`)}>
                                <SmallPlaybookIcon/>
                                <SubTitle>{playbook?.title}</SubTitle>
                            </PlaybookLink>
                        }
                    </VerticalBlock>
                    <ExpandRight/>
                    <Following userIds={following}/>
                    {followButton}
                    <Line/>
                    <ExportLink playbookRun={playbookRun}/>
                    <Link
                        to={`/${playbookRunMetadata.team_name}/channels/${playbookRunMetadata.channel_name}`}
                    >
                        <PrimaryButtonLarger style={{marginLeft: 12}}>
                            <Icon16 className={'icon icon-message-text-outline mr-1'}/>
                            {formatMessage({defaultMessage: 'Go to channel'})}
                        </PrimaryButtonLarger>
                    </Link>
                </FirstRow>
                <SecondRow>
                    <TabItem
                        to={`${match.url}/overview`}
                        activeClassName={'active'}
                    >
                        {formatMessage({defaultMessage: 'Overview'})}
                    </TabItem>
                    <TabItem
                        to={`${match.url}/retrospective`}
                        activeClassName={'active'}
                    >
                        {formatMessage({defaultMessage: 'Retrospective'})}
                        {!allowRetrospectiveAccess && <PositionedUpgradeBadge/>}
                    </TabItem>
                </SecondRow>
            </TopContainer>
            <BottomContainer>
                <InnerContainer>
                    <Switch>
                        <Route path={`${match.url}/overview`}>
                            <Overview playbookRun={playbookRun}/>
                        </Route>
                        <Route path={`${match.url}/retrospective`}>
                            <Retrospective
                                playbookRun={playbookRun}
                                metricsConfigs={playbook?.metrics}
                                deleteTimelineEvent={deleteTimelineEvent}
                                setRetrospective={setRetrospective}
                                setPublishedAt={setPublishedAt}
                                setCanceled={setCanceled}
                                setMetricsData={setMetricsData}
                            />
                        </Route>
                        <Redirect to={`${match.url}/overview`}/>
                    </Switch>
                </InnerContainer>
            </BottomContainer>
            <RunActionsModal playbookRun={playbookRun}/>
        </OuterContainer>
    );
};

export default PlaybookRunBackstage;
