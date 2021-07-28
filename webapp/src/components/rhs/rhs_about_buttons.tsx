// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';

import Icon from '@mdi/react';
import {mdiClipboardPlayOutline, mdiNotebookOutline} from '@mdi/js';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {PlaybookRun} from 'src/types/playbook_run';

import {pluginId} from 'src/manifest';
import {navigateToUrl} from 'src/browser_routing';
import {clientFetchPlaybook} from 'src/client';
import {HoverMenuButton} from 'src/components/rhs/rhs_shared';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';

interface Props {
    playbookRun: PlaybookRun;
    collapsed: boolean;
    toggleCollapsed: () => void;
}

const RHSAboutButtons = (props: Props) => {
    const currentTeam = useSelector(getCurrentTeam);
    const playbookName = usePlaybookName(props.playbookRun.playbook_id);

    const overviewURL = `/${currentTeam.name}/${pluginId}/runs/${props.playbookRun.id}`;
    const playbookURL = `/${currentTeam.name}/${pluginId}/playbooks/${props.playbookRun.playbook_id}`;

    return (
        <>
            <DotMenu
                icon={<ThreeDotsIcon/>}
                left={true}
                activeState={true}
                buttonSize={'28px'}
            >
                <StyledDropdownMenuItem onClick={() => navigateToUrl(overviewURL)}>
                    <DropdownIcon
                        path={mdiClipboardPlayOutline}
                        size={1.25}
                    />
                    {'Go to run overview'}
                </StyledDropdownMenuItem>
                <StyledDropdownMenuItem onClick={() => navigateToUrl(playbookURL)}>
                    <DropdownIcon
                        path={mdiNotebookOutline}
                        size={1.25}
                    />
                    <PlaybookInfo>
                        {'Go to playbook'}
                        {(playbookName !== '') && <PlaybookName>{playbookName}</PlaybookName>}
                    </PlaybookInfo>
                </StyledDropdownMenuItem>
            </DotMenu>
            <ExpandCollapseButton
                title={props.collapsed ? 'Expand' : 'Collapse'}
                className={(props.collapsed ? 'icon-arrow-expand' : 'icon-arrow-collapse') + ' icon-16 btn-icon'}
                tabIndex={0}
                role={'button'}
                onClick={props.toggleCollapsed}
                onKeyDown={(e) => {
                    // Handle Enter and Space as clicking on the button
                    if (e.keyCode === 13 || e.keyCode === 32) {
                        props.toggleCollapsed();
                    }
                }}
            />
        </>
    );
};

const usePlaybookName = (playbookId: string) => {
    const [playbookName, setPlaybookName] = useState('');

    useEffect(() => {
        const getPlaybookName = async () => {
            const playbook = await clientFetchPlaybook(playbookId);
            setPlaybookName(playbook?.title || '');
        };

        getPlaybookName();
    }, [playbookId]);

    return playbookName;
};

const ExpandCollapseButton = styled(HoverMenuButton)`
    margin-left: 2px
`;

const ThreeDotsIcon = styled(HamburgerButton)`
    font-size: 18px;
    margin-left: 1px;
`;

const DropdownIcon = styled(Icon)`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-right: 11px;
`;

const StyledDropdownMenuItem = styled(DropdownMenuItem)`
    display: flex;
    align-content: center;
`;

const PlaybookInfo = styled.div`
    display: flex;
    flex-direction: column;
`;

const PlaybookName = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;

    max-width: 162px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export default RHSAboutButtons;
