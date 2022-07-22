import React from 'react';
import styled, {css} from 'styled-components';
import {useSelector} from 'react-redux';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {useIntl} from 'react-intl';

import PlaybookIcon from '../assets/icons/playbook_icon';
import PrivatePlaybookIcon from '../assets/icons/private_playbook_icon';
import PlaybookRunIcon from '../assets/icons/playbook_run_icon';
import {pluginUrl} from 'src/browser_routing';
import {CategoryItem, CategoryItemType, Category} from 'src/types/category';
import {useCategories, useReservedCategoryTitleMapper} from 'src/hooks';

import Sidebar, {GroupItem, SidebarGroup} from './sidebar';
import CreatePlaybookDropdown from './create_playbook_dropdown';
import {ItemContainer, StyledNavLink, ItemDisplayLabel} from './item';

export const RunsCategoryName = 'runsCategory';
export const PlaybooksCategoryName = 'playbooksCategory';

const PlaybooksSidebar = () => {
    const teamID = useSelector(getCurrentTeamId);
    const categories = useCategories(teamID);
    const normalizeCategoryName = useReservedCategoryTitleMapper();

    const getGroupsFromCategories = (cats: Category[]): SidebarGroup[] => {
        const calculatedGroups = cats.map((category): SidebarGroup => {
            return {
                collapsed: category.collapsed,
                display_name: normalizeCategoryName(category.name),
                id: category.id,
                items: category.items ? category.items.map((item: CategoryItem): GroupItem => {
                    let icon = <StyledPlaybookRunIcon/>;
                    let link = pluginUrl(`/runs/${item.item_id}`);
                    if (item.type === CategoryItemType.PlaybookItemType) {
                        icon = item.public ? <StyledPlaybookIcon/> : <StyledPrivatePlaybookIcon/>;
                        link = `/playbooks/playbooks/${item.item_id}`;
                    }

                    return {
                        areaLabel: item.name,
                        className: '',
                        display_name: item.name,
                        id: item.item_id,
                        icon,
                        isCollapsed: false,
                        itemMenu: null,
                        link,
                    };
                }) : [],
            };
        });
        addViewAllsToGroups(calculatedGroups);
        return calculatedGroups;
    };

    const addViewAllsToGroups = (groups: SidebarGroup[]) => {
        for (let i = 0; i < groups.length; i++) {
            if (groups[i].id === RunsCategoryName) {
                groups[i].afterGroup = viewAllRuns();
            } else if (groups[i].id === PlaybooksCategoryName) {
                groups[i].afterGroup = viewAllPlaybooks();
            }
        }
    };

    const {formatMessage} = useIntl();
    const viewAllMessage = formatMessage({defaultMessage: 'View all...'});

    const viewAllRuns = () => {
        return (
            <ItemContainer>
                <StyledNavLink
                    id={'sidebarItem_view_all_runs'}
                    aria-label={formatMessage({defaultMessage: 'View all runs'})}
                    data-testid={'playbookRunsLHSButton'}
                    to={'/playbooks/runs'}
                    exact={true}
                >
                    <StyledItemDisplayLabel>
                        {viewAllMessage}
                    </StyledItemDisplayLabel>
                </StyledNavLink>
            </ItemContainer>
        );
    };

    const viewAllPlaybooks = () => {
        return (
            <ItemContainer key={'sidebarItem_view_all_playbooks'}>
                <StyledNavLink
                    id={'sidebarItem_view_all_playbooks'}
                    aria-label={formatMessage({defaultMessage: 'View all playbooks'})}
                    data-testid={'playbooksLHSButton'}
                    to={'/playbooks/playbooks'}
                    exact={true}
                >
                    <StyledItemDisplayLabel>
                        {viewAllMessage}
                    </StyledItemDisplayLabel>
                </StyledNavLink>
            </ItemContainer>
        );
    };

    const groups = getGroupsFromCategories(categories);
    return (
        <Sidebar
            groups={groups}
            headerDropdown={<CreatePlaybookDropdown team_id={teamID}/>}
            team_id={teamID}
        />
    );
};

export default PlaybooksSidebar;

const sharedIconStyles = css`
    width: 18px;
    height: 18px;
`;

const StyledPlaybookIcon = styled(PlaybookIcon)`
    ${sharedIconStyles}
`;

const StyledPlaybookRunIcon = styled(PlaybookRunIcon)`
    ${sharedIconStyles}
`;

const StyledPrivatePlaybookIcon = styled(PrivatePlaybookIcon)`
    ${sharedIconStyles}
`;

const StyledItemDisplayLabel = styled(ItemDisplayLabel)`
    line-height: 20px;
    color: rgba(var(--sidebar-text-rgb), 0.56);
`;
