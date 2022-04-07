// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';

import {PlaybookWithChecklist} from 'src/types/playbook';

import renderActions from 'src/components/backstage/playbooks/playbook_preview_actions';
import renderChecklists from 'src/components/backstage/playbooks/playbook_preview_checklists';
import renderRetrospective from 'src/components/backstage/playbooks/playbook_preview_retrospective';
import renderStatusUpdates from 'src/components/backstage/playbooks/playbook_preview_status_updates';

import ScrollNavBase, {SectionID} from './scroll_nav';

interface Props {
    playbook: PlaybookWithChecklist;
    runsInProgress: number;
    followerIds: string[];
}

/** @alpha replace/copy-pasta/unfold sections as-needed*/
const Outline = (props: Props) => {
    const checklists = renderChecklists({
        id: SectionID.Checklists,
        playbook: props.playbook,
    });

    const actions = renderActions({
        id: SectionID.Actions,
        playbook: props.playbook,
        followerIds: props.followerIds,
    });

    const statusUpdates = renderStatusUpdates({
        id: SectionID.StatusUpdates,
        playbook: props.playbook,
    });

    const retrospective = renderRetrospective({
        id: SectionID.Retrospective,
        playbook: props.playbook,
    });

    return (
        <>
            <ScrollNav
                playbook={props.playbook}
                runsInProgress={props.runsInProgress}
                archived={props.playbook.delete_at !== 0}
                showElements={{
                    statusUpdates: statusUpdates !== null,
                    checklists: checklists !== null,
                    actions: actions !== null,
                    retrospective: retrospective !== null,
                }}
            />
            <Sections data-testid='preview-content'>
                {statusUpdates}
                {checklists}
                {retrospective}
                {actions}
            </Sections>
        </>
    );
};

export const ScrollNav = styled(ScrollNavBase)`

`;

export const Sections = styled.div`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    margin-bottom: 40px;
    padding: 5rem;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 8px;
    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.12);
    background: var(--center-channel-bg);
`;

export default Outline;
