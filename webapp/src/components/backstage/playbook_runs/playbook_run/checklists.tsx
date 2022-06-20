// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {PlaybookRun} from 'src/types/playbook_run';

import RHSChecklistList, {ChecklistParent} from 'src/components/rhs/rhs_checklist_list';
interface Props {
    playbookRun: PlaybookRun;
}
const Checklists = ({playbookRun}: Props) => {
    return (
        <Container data-testid={'run-checklist-section'}>
            <RHSChecklistList
                playbookRun={playbookRun}
                parentContainer={ChecklistParent.RunDetails}
            />
        </Container>);
};

export default Checklists;

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
`;
