// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import styled from 'styled-components';

import Icon from '@mdi/react';
import {mdiClipboardPlayOutline, mdiNotebookOutline} from '@mdi/js';

import {PlaybookRun} from 'src/types/playbook_run';

import {navigateToPluginUrl} from 'src/browser_routing';
import {HoverMenuButton} from 'src/components/rhs/rhs_shared';
import DotMenu, {DotMenuButton, DropdownMenuItem} from 'src/components/dot_menu';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';
import {usePlaybookName} from 'src/hooks';

interface Props {
    playbookRun: PlaybookRun;
    collapsed: boolean;
    toggleCollapsed: () => void;
}

const RHSAboutButtons = (props: Props) => {
    const playbookName = usePlaybookName(props.playbookRun.playbook_id);

    const overviewURL = `/runs/${props.playbookRun.id}`;
    const playbookURL = `/playbooks/${props.playbookRun.playbook_id}`;

    return (
        <>
            <ExpandCollapseButton
                title={props.collapsed ? 'Expand' : 'Collapse'}
                className={(props.collapsed ? 'icon-chevron-down' : 'icon-chevron-up') + ' icon-16 btn-icon'}
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
            <DotMenu
                icon={<ThreeDotsIcon/>}
                left={true}
                dotMenuButton={StyledDotMenuButton}
            >
                <StyledDropdownMenuItem onClick={() => navigateToPluginUrl(overviewURL)}>
                    <DropdownIcon
                        path={mdiClipboardPlayOutline}
                        size={1.25}
                    />
                    {'Go to run overview'}
                </StyledDropdownMenuItem>
                <StyledDropdownMenuItem onClick={() => navigateToPluginUrl(playbookURL)}>
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
        </>
    );
};

const StyledDotMenuButton = styled(DotMenuButton)`
    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }

    width: 28px;
    height: 28px;
`;

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
