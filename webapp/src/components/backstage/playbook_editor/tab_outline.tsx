// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';

import {PlaybookWithChecklist} from 'src/types/playbook';

import renderActions from 'src/components/backstage/playbooks/playbook_preview_actions';
import renderChecklists from 'src/components/backstage/playbooks/playbook_preview_checklists';
import renderDescription from 'src/components/backstage/playbooks/playbook_preview_description';
import renderRetrospective from 'src/components/backstage/playbooks/playbook_preview_retrospective';
import renderStatusUpdates from 'src/components/backstage/playbooks/playbook_preview_status_updates';
import {HorizontalBG} from 'src/components/collapsible_checklist';

import Navbar, {SectionID} from './tab_outline_navbar';

interface Props {
    playbook: PlaybookWithChecklist;
    runsInProgress: number;
    followerIds: string[];
}

/** @alpha replace/copy-pasta/unfold sections as-needed*/
const Outline = (props: Props) => {
    const description = renderDescription({
        id: SectionID.Description,
        playbook: props.playbook,
    });

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
        <Container>
            <Navbar
                playbook={props.playbook}
                runsInProgress={props.runsInProgress}
                archived={props.playbook.delete_at !== 0}
                showElements={{
                    description: description !== null,
                    checklists: checklists !== null,
                    actions: actions !== null,
                    statusUpdates: statusUpdates !== null,
                    retrospective: retrospective !== null,
                }}
            />
            <Content data-testid='preview-content'>
                {description}
                {checklists}
                {actions}
                {statusUpdates}
                {retrospective}
            </Content>
        </Container>
    );
};

const Container = styled.main`
    height: 100%;
    display: flex;
    flex-direction: row;
    justify-content: center;
    flex-grow: 1;
    column-gap: 7rem;
    padding: 40px 20px 20px;
    z-index: 1;

    ${HorizontalBG} {
        /* sticky checklist header */
        top: 82px;
    }
`;

const Content = styled.div`
    display: flex;
    flex-direction: column;
    max-width: 780px;
    margin-bottom: 40px;
    flex-grow: 1;
`;

export default Outline;
