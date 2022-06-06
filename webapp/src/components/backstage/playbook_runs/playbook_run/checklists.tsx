import React from 'react';
import styled from 'styled-components';

import {PlaybookRun} from 'src/types/playbook_run';

import RHSChecklistList from 'src/components/rhs/rhs_checklist_list';
interface Props {
    playbookRun: PlaybookRun;
}
const Checklists = (props: Props) => {
    return (<Container>
        <RHSChecklistList playbookRun={props.playbookRun}/>
    </Container>);
};

export default Checklists;

const Container = styled.div`
    display: flex;
    flex-direction: row;
`;
