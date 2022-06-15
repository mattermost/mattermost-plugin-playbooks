import React from 'react';
import styled, {css} from 'styled-components';

import PlaybookIcon from '../assets/icons/playbook_icon';
import PrivatePlaybookIcon from '../assets/icons/private_playbook_icon';
import PlaybookRunIcon from '../assets/icons/playbook_run_icon';
import {
    usePlaybooksCrud,
} from 'src/hooks';
import {pluginUrl} from 'src/browser_routing';
import {useRunsList} from 'src/hooks/general';
import {PlaybookRunStatus} from 'src/types/playbook_run';

import Sidebar, {GroupItem, SidebarGroup} from './sidebar';

const defaultRunsFetchParams = {
    page: 0,
    per_page: 20,
    sort: 'last_status_update_at',
    direction: 'desc',
    statuses: [PlaybookRunStatus.InProgress, PlaybookRunStatus.Finished],
};

interface PlaybookSidebarProps{
    team_id: string;
}

const PlaybooksSidebar = (props: PlaybookSidebarProps) => {
    const groups: Array<SidebarGroup> = [];

    const [playbooks] = usePlaybooksCrud({team_id: props.team_id, per_page: 20});
    const [playbookRuns] = useRunsList(defaultRunsFetchParams);

    // Not a correct list of playbooks, should be changed
    const playbooksItems = playbooks ? playbooks.map((playbook) => {
        return {
            areaLabel: playbook.title,
            className: '',
            display_name: playbook.title,
            icon: playbook.public ? <StyledPlaybookIcon/> : <StyledPrivatePlaybookIcon/>,
            isCollapsed: false,
            itemMenu: null,
            link: `/playbooks/playbooks/${playbook.id}`,
        };
    }) : [];

    const playbooksGroup: SidebarGroup = {
        collapsed: false,
        display_name: 'Playbooks',
        id: 'playbooks',
        items: playbooksItems,
    };

    // Not a correct list of runs, should be changed
    const runsItems = playbookRuns ? playbookRuns.map((run): GroupItem => {
        return {
            areaLabel: run.name,
            className: '',
            display_name: run.name,
            icon: <StyledPlaybookRunIcon/>,
            isCollapsed: false,
            itemMenu: null,
            link: pluginUrl(`/run_details/${run.id}`),
        };
    }) : [];

    const runsGroup: SidebarGroup = {
        collapsed: false,
        display_name: 'Runs',
        id: 'runs',
        items: runsItems,
    };

    // favorite category rendered statically for the UI, should be changed
    const favItems: Array<GroupItem> = [
        {
            areaLabel: 'Cool playbook',
            className: '',
            display_name: 'Cool playbook',
            icon: <StyledPlaybookIcon/>,
            isCollapsed: false,
            itemMenu: null,
            link: 'some',
        },
        {
            areaLabel: 'Cool run',
            className: '',
            display_name: 'Cool run',
            icon: <StyledPlaybookRunIcon/>,
            isCollapsed: false,
            itemMenu: null,
            link: 'some',
        },
    ];

    const fav: SidebarGroup = {
        collapsed: false,
        display_name: 'Favorites',
        id: 'favorites',
        items: favItems,
    };
    groups.push(fav);
    groups.push(runsGroup);
    groups.push(playbooksGroup);

    return (
        <Sidebar
            groups={groups}
            headerDropdown={null}
            onGroupClick={() => {/*empty*/}}
            team_id={props.team_id}
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
