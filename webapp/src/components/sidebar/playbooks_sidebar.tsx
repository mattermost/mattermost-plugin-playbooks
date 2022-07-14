import React from 'react';
import styled, {css} from 'styled-components';
import {useSelector} from 'react-redux';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import PlaybookIcon from '../assets/icons/playbook_icon';
import PrivatePlaybookIcon from '../assets/icons/private_playbook_icon';
import PlaybookRunIcon from '../assets/icons/playbook_run_icon';
import {pluginUrl} from 'src/browser_routing';
import {CategoryItem, CategoryItemType, Category} from 'src/types/category';
import {useCategories} from 'src/hooks';

import Sidebar, {GroupItem, SidebarGroup} from './sidebar';
import CreatePlaybookDropdown from './create_playbook_dropdown';
interface PlaybookSidebarProps {
    team_id: string;
}

const PlaybooksSidebar = (props: PlaybookSidebarProps) => {
    const teams = useSelector(getMyTeams);
    const teamID = props.team_id || teams[0].id;
    const categories = useCategories(teamID);

    const getGroupsFromCategories = (cats: Category[]): SidebarGroup[] => {
        const calculatedGroups = cats.map((category): SidebarGroup => {
            return {
                collapsed: category.collapsed,
                display_name: category.name,
                id: category.id,
                items: category.items ? category.items.map((item: CategoryItem): GroupItem => {
                    let icon = <StyledPlaybookRunIcon/>;
                    let link = pluginUrl(`/run_details/${item.item_id}`);
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
        return calculatedGroups;
    };

    const groups = getGroupsFromCategories(categories);
    return (
        <Sidebar
            groups={groups}
            headerDropdown={<CreatePlaybookDropdown team_id={teamID}/>}
            onGroupClick={() => {/*empty*/}}
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
