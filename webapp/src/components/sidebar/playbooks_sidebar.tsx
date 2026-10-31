// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {useIntl} from 'react-intl';

import {useAppSelector} from 'src/hooks/redux';

import {ReservedCategory, useReservedCategoryTitleMapper} from 'src/hooks';

import {pluginUrl} from 'src/browser_routing';

import {Mark, mark} from 'src/performance_telemetry';

import {LHSPlaybookDotMenu} from 'src/components/backstage/lhs_playbook_dot_menu';
import {LHSRunDotMenu} from 'src/components/backstage/lhs_run_dot_menu';
import {subscribeLHSRefresh} from 'src/components/backstage/lhs_navigation';
import {PlaybookRun, PlaybookRunType, RunStatus} from 'src/types/playbook_run';
import {clientFetchPlaybooks, fetchPlaybookRuns} from 'src/client';
import {Playbook} from 'src/types/playbook';

import Sidebar, {SidebarGroup} from './sidebar';
import CreatePlaybookDropdown from './create_playbook_dropdown';
import {ItemContainer, StyledNavLink} from './item';

export const RunsCategoryName = 'runsCategory';
export const PlaybooksCategoryName = 'playbooksCategory';

const pollInterval = 60000; // Poll every minute for updates

type LHSData = {
    runs: PlaybookRun[];
    playbooks: Playbook[];
};

const useLHSData = (teamID: string) => {
    const normalizeCategoryName = useReservedCategoryTitleMapper();
    const [data, setData] = useState<LHSData | undefined>();
    const [error, setError] = useState<Error | undefined>();
    const [refreshKey, setRefreshKey] = useState(0);
    const latestRequest = useRef(0);

    const load = useCallback(async () => {
        if (!teamID) {
            return;
        }
        const requestID = ++latestRequest.current;
        try {
            const [runsResult, playbooksResult] = await Promise.all([
                fetchPlaybookRuns({
                    page: 0,
                    per_page: 1000,
                    team_id: teamID,
                    sort: 'name',
                    direction: 'ASC',
                    statuses: [RunStatus.InProgress],
                    types: [PlaybookRunType.Playbook, PlaybookRunType.ChannelChecklist],
                    participant_or_follower_id: 'me',
                    include_favorites: true,
                    skip_extras: true,
                    skip_checklists: true,
                    include_favorite: true,
                    include_followers: true,
                }),
                clientFetchPlaybooks(teamID, {
                    page: 0,
                    per_page: 1000,
                    with_membership_only: true,
                    include_favorite: true,
                }),
            ]);
            if (requestID !== latestRequest.current) {
                return;
            }
            setData({
                runs: runsResult.items ?? [],
                playbooks: playbooksResult?.items ?? [],
            });
            setError(undefined);
        } catch (err) {
            if (requestID !== latestRequest.current) {
                return;
            }
            setError(err instanceof Error ? err : new Error(String(err)));
        }
    }, [teamID]);

    useEffect(() => {
        load();
    }, [load, refreshKey]);

    useEffect(() => {
        return subscribeLHSRefresh(() => setRefreshKey((key) => key + 1));
    }, []);

    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined;
        const focus = () => {
            timer = setInterval(() => setRefreshKey((key) => key + 1), pollInterval);
        };
        const blur = () => {
            if (timer) {
                clearInterval(timer);
                timer = undefined;
            }
        };
        window.addEventListener('focus', focus);
        window.addEventListener('blur', blur);
        if (document.hasFocus()) {
            focus();
        }

        return () => {
            blur();
            window.removeEventListener('focus', focus);
            window.removeEventListener('blur', blur);
        };
    }, []);

    if (error || !data) {
        return {groups: [] as SidebarGroup[], ready: false};
    }

    const {runs, playbooks} = data;

    const playbookItems = playbooks.map((pb) => {
        const icon = pb.public ? 'icon-book-outline' : 'icon-book-lock-outline';
        const link = `/playbooks/playbooks/${pb.id}`;

        return {
            areaLabel: pb.title,
            display_name: pb.title,
            id: pb.id,
            icon,
            link,
            isCollapsed: false,
            itemMenu: (
                <LHSPlaybookDotMenu
                    playbookId={pb.id}
                    isFavorite={Boolean(pb.is_favorite)}
                />),
            isFavorite: Boolean(pb.is_favorite),
            className: '',
        };
    });
    const playbookFavorites = playbookItems.filter((group) => group.isFavorite);
    const playbooksWithoutFavorites = playbookItems.filter((group) => !group.isFavorite);

    const hasViewerAccessToPlaybook = (playbookId: string) => {
        return playbooks.find((pb) => pb.id === playbookId) !== undefined;
    };

    const runItems = runs.map((run) => {
        const icon = run.type === PlaybookRunType.Playbook ? 'icon-play-outline' : 'icon-check-all';
        const link = pluginUrl(`/runs/${run.id}?from=playbooks_lhs`);

        return {
            areaLabel: run.name,
            display_name: run.name,
            id: run.id,
            icon,
            link,
            isCollapsed: false,
            itemMenu: (
                <LHSRunDotMenu
                    playbookRunId={run.id}
                    isFavorite={Boolean(run.is_favorite)}
                    ownerUserId={run.owner_user_id}
                    participantIDs={run.participant_ids}
                    followerIDs={run.followers ?? []}
                    hasPermanentViewerAccess={hasViewerAccessToPlaybook(run.playbook_id)}
                />),
            isFavorite: Boolean(run.is_favorite),
            className: '',
        };
    });
    const runFavorites = runItems.filter((group) => group.isFavorite);
    const runsWithoutFavorites = runItems.filter((group) => !group.isFavorite);

    const allFavorites = playbookFavorites.concat(runFavorites);
    let groups = [
        {
            collapsed: false,
            display_name: normalizeCategoryName(ReservedCategory.Runs),
            id: ReservedCategory.Runs,
            items: runsWithoutFavorites,
        },
        {
            collapsed: false,
            display_name: normalizeCategoryName(ReservedCategory.Playbooks),
            id: ReservedCategory.Playbooks,
            items: playbooksWithoutFavorites,
        },
    ];
    if (allFavorites.length > 0) {
        groups = [
            {
                collapsed: false,
                display_name: normalizeCategoryName(ReservedCategory.Favorite),
                id: ReservedCategory.Favorite,
                items: playbookFavorites.concat(runFavorites),
            },
        ].concat(groups);
    }

    return {groups: groups as SidebarGroup[], ready: true};
};

const ViewAllRuns = () => {
    const {formatMessage} = useIntl();
    const viewAllMessage = formatMessage({defaultMessage: 'View all...'});

    function handleClick() {
        mark(Mark.PlaybookRunsLHSButtonClicked);
    }

    return (
        <ItemContainer>
            <ViewAllNavLink
                id={'sidebarItem_view_all_runs'}
                aria-label={formatMessage({defaultMessage: 'View all runs'})}
                data-testid={'playbookRunsLHSButton'}
                to={'/playbooks/runs'}
                exact={true}
                onClick={handleClick}
            >
                {viewAllMessage}
            </ViewAllNavLink>
        </ItemContainer>
    );
};

const ViewAllPlaybooks = () => {
    const {formatMessage} = useIntl();
    const viewAllMessage = formatMessage({defaultMessage: 'View all...'});

    function handleClick() {
        mark(Mark.PlaybooksLHSButtonClicked);
    }

    return (
        <ItemContainer key={'sidebarItem_view_all_playbooks'}>
            <ViewAllNavLink
                id={'sidebarItem_view_all_playbooks'}
                aria-label={formatMessage({defaultMessage: 'View all playbooks'})}
                data-testid={'playbooksLHSButton'}
                to={'/playbooks/playbooks'}
                exact={true}
                onClick={handleClick}
            >
                {viewAllMessage}
            </ViewAllNavLink>
        </ItemContainer>
    );
};

const addViewAllsToGroups = (groups: SidebarGroup[]) => {
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === ReservedCategory.Runs) {
            groups[i].afterGroup = <ViewAllRuns/>;
        } else if (groups[i].id === ReservedCategory.Playbooks) {
            groups[i].afterGroup = <ViewAllPlaybooks/>;
        }
    }
};

const PlaybooksSidebar = () => {
    const teamID = useAppSelector(getCurrentTeamId);
    const {groups, ready} = useLHSData(teamID);

    if (!ready) {
        return (
            <Sidebar
                groups={[]}
                headerDropdown={<CreatePlaybookDropdown team_id={teamID}/>}
                team_id={teamID}
            />
        );
    }

    addViewAllsToGroups(groups);

    return (
        <Sidebar
            groups={groups}
            headerDropdown={<CreatePlaybookDropdown team_id={teamID}/>}
            team_id={teamID}
        />
    );
};

export default PlaybooksSidebar;

const ViewAllNavLink = styled(StyledNavLink)`
    &&& {
        &:not(.active) {
            color: rgba(var(--sidebar-text-rgb), 0.56);
        }

        padding-left: 23px;
    }
`;
