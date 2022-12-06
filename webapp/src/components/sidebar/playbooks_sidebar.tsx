import React, {ComponentType, ComponentProps} from 'react';
import styled, {css} from 'styled-components';
import {useSelector} from 'react-redux';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {useIntl} from 'react-intl';
import {useRouteMatch} from 'react-router-dom';

import {ReservedCategory, useReservedCategoryTitleMapper} from 'src/hooks';

import {usePlaybookLhsQuery} from 'src/graphql/generated_types';

import {pluginUrl} from 'src/browser_routing';
import {LHSPlaybookDotMenu} from '../backstage/lhs_playbook_dot_menu';
import {LHSRunDotMenu} from '../backstage/lhs_run_dot_menu';

import {useThreadsLinkMeta} from 'src/webapp_globals';

import Sidebar, {SidebarGroup} from './sidebar';
import CreatePlaybookDropdown from './create_playbook_dropdown';
import {ItemContainer, StyledNavLink} from './item';

export const RunsCategoryName = 'runsCategory';
export const PlaybooksCategoryName = 'playbooksCategory';

const useLHSData = (teamID: string) => {
    const normalizeCategoryName = useReservedCategoryTitleMapper();
    const {data, error} = usePlaybookLhsQuery({
        variables: {
            userID: 'me',
            teamID,
        },
        fetchPolicy: 'cache-and-network',
        pollInterval: 60000, // Poll every minute for updates
    });

    if (error || !data) {
        return {groups: [], ready: false};
    }

    const playbookItems = data.playbooks.map((pb) => {
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
                    isFavorite={pb.isFavorite}
                />),
            isFavorite: pb.isFavorite,
            className: '',
        };
    });
    const playbookFavorites = playbookItems.filter((group) => group.isFavorite);
    const playbooksWithoutFavorites = playbookItems.filter((group) => !group.isFavorite);

    const hasViewerAccessToPlaybook = (playbookId: string) => {
        // if the run's playbook is visible to the user, then they have permanent access to the run
        return data.playbooks.find((pb) => pb.id === playbookId) !== undefined;
    };

    const runItems = data.runs.map((run) => {
        const icon = 'icon-play-outline';
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
                    isFavorite={run.isFavorite}
                    ownerUserId={run.ownerUserID}
                    participantIDs={run.participantIDs}
                    followerIDs={run.metadata.followers}
                    hasPermanentViewerAccess={hasViewerAccessToPlaybook(run.playbookID)}
                />),
            isFavorite: run.isFavorite,
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

    return {groups, ready: true};
};

const ViewAllRuns = () => {
    const {formatMessage} = useIntl();
    return (
        <ItemContainer>
            <ViewAllNavLink
                id={'sidebarItem_view_all_runs'}
                aria-label={formatMessage({defaultMessage: 'View all runs'})}
                data-testid={'playbookRunsLHSButton'}
                to={'/playbooks/runs'}
                exact={true}
            >
                {formatMessage({defaultMessage: 'View all...'})}
            </ViewAllNavLink>
        </ItemContainer>
    );
};

const ViewAllPlaybooks = () => {
    const {formatMessage} = useIntl();
    return (
        <ItemContainer key={'sidebarItem_view_all_playbooks'}>
            <ViewAllNavLink
                id={'sidebarItem_view_all_playbooks'}
                aria-label={formatMessage({defaultMessage: 'View all playbooks'})}
                data-testid={'playbooksLHSButton'}
                to={'/playbooks/playbooks'}
                exact={true}
            >
                {formatMessage({defaultMessage: 'View all...'})}
            </ViewAllNavLink>
        </ItemContainer>
    );
};

const ViewThreads = () => {
    const {formatMessage} = useIntl();
    const {url} = useRouteMatch();

    const {
        isCrtEnabled,
        counts,
        someUnreadThreads,
        threads,
        threadsCount,
    } = useThreadsLinkMeta();

    if (!isCrtEnabled) {
        return null;
    }

    return (
        <ItemContainer key={'sidebarItem_view_threads'}>
            <ThreadsNavLink
                id={'sidebarItem_view_threads'}
                aria-label={formatMessage({defaultMessage: 'View all playbooks'})}
                data-testid={'playbooksLHSButton'}
                to={`${url}/threads`}
                someUnreadThreads={someUnreadThreads}
            >
                {formatMessage({defaultMessage: 'Threads'})}
                {Boolean(counts?.total_unread_mentions) && (
                    <UnreadBadge
                        hasUrgent={Boolean(counts?.total_unread_urgent_mentions)}
                    >
                        {counts?.total_unread_mentions}
                    </UnreadBadge>
                )}
            </ThreadsNavLink>
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
    const teamID = useSelector(getCurrentTeamId);
    const {groups, ready} = useLHSData(teamID);

    if (ready) {
        addViewAllsToGroups(groups);
    }

    return (
        <Sidebar
            groups={groups}
            static={(
                <>
                    <ViewThreads/>
                </>
            )}
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

const ThreadsNavLink = styled<ComponentType<ComponentProps<typeof StyledNavLink> & {someUnreadThreads: boolean;}>>(StyledNavLink)`
    &&& {
        padding-left: 23px;
        &:hover {
            padding-right: 16px;
        }
        justify-content: space-between;

        ${({someUnreadThreads}) => (someUnreadThreads ? css`
            font-weight: 600;
            color: var(--sidebar-unread-text);
        ` : css`
            &:not(.active) {
                color: rgba(var(--sidebar-text-rgb), 0.56);
            }
        `)}
    }
`;

const UnreadBadge = styled.span<{hasUrgent: boolean;}>`
    display: inline-block;
    flex-shrink: 0;
    margin: 0 4px;
    min-width: 20px;
    height: auto;
    padding: 0 6px;
    border-radius: 8px;
    font-size: 11px;
    -webkit-font-smoothing: subpixel-antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 16px;
    text-align: center;
    background: var(--mention-bg);
    color: var(--mention-color);
    ${({hasUrgent}) => hasUrgent && css`
        background-color: var(--dnd-indicator);
        color: #fff;
    `}
`;
