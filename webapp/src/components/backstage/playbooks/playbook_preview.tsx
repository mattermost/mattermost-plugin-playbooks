// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';

import {PlaybookWithChecklist} from 'src/types/playbook';

import Actions from 'src/components/backstage/playbooks/playbook_preview_actions';
import Checklists from 'src/components/backstage/playbooks/playbook_preview_checklists';
import Description from 'src/components/backstage/playbooks/playbook_preview_description';
import Navbar, {SectionID} from 'src/components/backstage/playbooks/playbook_preview_navbar';
import Retrospective from 'src/components/backstage/playbooks/playbook_preview_retrospective';
import StatusUpdates from 'src/components/backstage/playbooks/playbook_preview_status_updates';

interface Props {
    playbook: PlaybookWithChecklist;
    runsInProgress: number;
}

const PlaybookPreview = (props: Props) => {
    return (
        <Container>
            <Content>
                <Description
                    id={SectionID.Description}
                    playbook={props.playbook}
                />
                <Checklists
                    id={SectionID.Checklists}
                    playbook={props.playbook}
                />
                <Actions
                    id={SectionID.Actions}
                    playbook={props.playbook}
                />
                <StatusUpdates
                    id={SectionID.StatusUpdates}
                    playbook={props.playbook}
                />
                <Retrospective
                    id={SectionID.Retrospective}
                    playbook={props.playbook}
                />
            </Content>
            <Navbar
                playbookId={props.playbook.id}
                runsInProgress={props.runsInProgress}
            />
        </Container>
    );
};

const Container = styled.main`
    display: flex;
    flex-direction: row;
    justify-content: center;
    flex-grow: 1;

    column-gap: 114px;

    padding-top: 40px;

    background-color: rgba(var(--center-channel-color-rgb),0.04);
`;

const Content = styled.div`
    display: flex;
    flex-direction: column;
    max-width: 780px;
    margin-bottom: 40px;

    flex-grow: 1;
`;

export default PlaybookPreview;
