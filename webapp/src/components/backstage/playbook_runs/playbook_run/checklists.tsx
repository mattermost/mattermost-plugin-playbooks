import React from 'react';
import styled from 'styled-components';

import {PlaybookRun} from 'src/types/playbook_run';

import RHSChecklistList, {ChecklistParent} from 'src/components/rhs/rhs_checklist_list';
interface Props {
    playbookRun: PlaybookRun;
}
const Checklists = (props: Props) => {
    return (
        <Container>
            <RHSChecklistList
                playbookRun={props.playbookRun}
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