// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {PlaybookRun} from 'src/types/playbook_run';

import RHSChecklistList, {ChecklistParent} from 'src/components/rhs/rhs_checklist_list';
import {Role} from 'src/components/backstage/playbook_runs/shared';

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
}
const Checklists = ({playbookRun, role}: Props) => {
    return (
        <Container data-testid={'run-checklist-section'}>
            <RHSChecklistList
                playbookRun={playbookRun}
                parentContainer={ChecklistParent.RunDetails}
                viewerMode={role === Role.Viewer}
            />
        </Container>);
};

export default Checklists;

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
`;
