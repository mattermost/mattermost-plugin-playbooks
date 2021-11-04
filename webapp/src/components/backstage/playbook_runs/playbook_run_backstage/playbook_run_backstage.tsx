// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import styled from 'styled-components';
import {Redirect, Route, useRouteMatch, NavLink, Switch} from 'react-router-dom';
import {useIntl} from 'react-intl';

import {GlobalState} from 'mattermost-redux/types/store';
import {Channel} from 'mattermost-redux/types/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {
    Badge,
    ExpandRight,
    PrimaryButtonLarger,
} from 'src/components/backstage/playbook_runs/shared';

import {PlaybookRun, Metadata as PlaybookRunMetadata} from 'src/types/playbook_run';
import {Overview} from 'src/components/backstage/playbook_runs/playbook_run_backstage/overview/overview';
import {Retrospective} from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/retrospective';
import Followers from 'src/components/backstage/playbook_runs/playbook_run_backstage/followers';

import {
    clientFetchPlaybook,
    clientRemoveTimelineEvent,
    fetchPlaybookRun,
    fetchPlaybookRunMetadata,
    followPlaybookRun,
    unfollowPlaybookRun,
} from 'src/client';
import {navigateToUrl, navigateToPluginUrl, pluginErrorUrl} from 'src/browser_routing';
import {ErrorPageTypes} from 'src/constants';
import {useAllowRetrospectiveAccess, useForceDocumentTitle} from 'src/hooks';
import {RegularHeading} from 'src/styles/headings';

import UpgradeBadge from 'src/components/backstage/upgrade_badge';
import PlaybookIcon from 'src/components/assets/icons/playbook_icon';
import {PlaybookWithChecklist} from 'src/types/playbook';
import ExportLink from '../playbook_run_details/export_link';

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
    box-shadow: inset 0px -1px 0px var(--center-channel-color-16);
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

const LeftArrow = styled.button`
    display: block;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 24px;
    line-height: 24px;
    cursor: pointer;
    color: var(--center-channel-color-56);

    &:hover {
        background: var(--button-bg-08);
        color: var(--button-bg);
    }
`;

const VerticalBlock = styled.div`
    display: flex;
    flex-direction: column;
    font-weight: 400;
    padding: 0 16px 0 24px;
`;

const Title = styled.div`
    ${RegularHeading}

    font-size: 20px;
    color: var(--center-channel-color);
`;

const PlaybookDiv = styled.div`
    display: flex;
    flex-direction: row;
    color: var(--center-channel-color-64);
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

const PlaybookRunBackstage = () => {
    const [playbookRun, setPlaybookRun] = useState<PlaybookRun | null>(null);
    const [playbookRunMetadata, setPlaybookRunMetadata] = useState<PlaybookRunMetadata | null>(null);
    const [playbook, setPlaybook] = useState<PlaybookWithChecklist | null>(null);
    const {formatMessage} = useIntl();
    const match = useRouteMatch<MatchParams>();
    const currentUserID = useSelector(getCurrentUserId);
    const [followers, setFollowers] = useState<string[]>([]);

    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);

    const allowRetrospectiveAccess = useAllowRetrospectiveAccess();

    useForceDocumentTitle(playbookRun?.name ? (playbookRun.name + ' - Playbooks') : 'Playbooks');

    useEffect(() => {
        const playbookRunId = match.params.playbookRunId;

        Promise.all([fetchPlaybookRun(playbookRunId), fetchPlaybookRunMetadata(playbookRunId)]).then(([playbookRunResult, playbookRunMetadataResult]) => {
            setPlaybookRun(playbookRunResult);
            setPlaybookRunMetadata(playbookRunMetadataResult);
            setFetchingState(FetchingStateType.fetched);
            setFollowers(playbookRunMetadataResult && playbookRunMetadataResult.followers ? playbookRunMetadataResult.followers : []);
        }).catch(() => {
            setFetchingState(FetchingStateType.notFound);
        });
    }, [match.params.playbookRunId]);

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

    if (fetchingState === FetchingStateType.loading) {
        return null;
    }

    if (fetchingState === FetchingStateType.notFound || playbookRun === null || playbookRunMetadata === null) {
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOK_RUNS)}/>;
    }

    const goToChannel = () => {
        navigateToUrl(`/${playbookRunMetadata.team_name}/channels/${playbookRunMetadata.channel_name}`);
    };

    const onFollow = () => {
        if (followers.includes(currentUserID)) {
            return;
        }
        followPlaybookRun(playbookRun.id);
        const followersCopy = [...followers, currentUserID];
        setFollowers(followersCopy);
    };

    const onUnfollow = () => {
        unfollowPlaybookRun(playbookRun.id);
        const followersCopy = followers.filter((item) => item !== currentUserID);
        setFollowers(followersCopy);
    };

    const closePlaybookRunDetails = () => {
        navigateToPluginUrl('/runs');
    };

    let followButton = (<Button onClick={onFollow}>{formatMessage({defaultMessage: 'Follow'})}</Button>);
    if (followers.includes(currentUserID)) {
        followButton = (<Button onClick={onUnfollow}>{formatMessage({defaultMessage: 'Unfollow'})}</Button>);
    }

    return (
        <OuterContainer>
            <TopContainer>
                <FirstRow>
                    <LeftArrow
                        className='icon-arrow-left'
                        onClick={closePlaybookRunDetails}
                    />
                    <VerticalBlock>
                        <Title data-testid='playbook-run-title'>{playbookRun.name}</Title>
                        {playbook &&
                            <PlaybookDiv onClick={() => navigateToPluginUrl(`/playbooks/${playbook?.id}`)}>
                                <SmallPlaybookIcon/>
                                <SubTitle>{playbook?.title}</SubTitle>
                            </PlaybookDiv>
                        }
                    </VerticalBlock>
                    <Badge status={playbookRun.current_status}/>
                    <ExpandRight/>
                    <Followers userIds={followers}/>
                    {followButton}
                    <Line/>
                    <ExportLink playbookRun={playbookRun}/>
                    <PrimaryButtonLarger onClick={goToChannel}>
                        <i className={'icon icon-message-text-outline mr-1'}/>
                        {formatMessage({defaultMessage: 'Go to channel'})}
                    </PrimaryButtonLarger>
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
                                deleteTimelineEvent={deleteTimelineEvent}
                            />
                        </Route>
                        <Redirect to={`${match.url}/overview`}/>
                    </Switch>
                </InnerContainer>
            </BottomContainer>
        </OuterContainer>
    );
};

export default PlaybookRunBackstage;
