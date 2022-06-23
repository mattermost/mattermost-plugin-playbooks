import React from 'react';
import styled from 'styled-components';
import Icon from '@mdi/react';
import {mdiCheckAll, mdiPlayOutline, mdiCircleSmall} from '@mdi/js';

import {setChecklistItemState} from 'src/client';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {ChecklistItem as ItemComponent} from 'src/components/checklist_item/checklist_item';
import {HoverMenu} from 'src/components/checklist_item/hover_menu';

interface Props {
    item: ChecklistItem;
    checklistNum: number;
    itemNum: number;
    checklistTitle: string;
    playbookRunId: string;
    playbookRunName: string;
}

const Task = ({item, playbookRunName, checklistTitle, checklistNum, itemNum, playbookRunId} : Props) => {
    return (
        <Container>
            <Header>
                <Icon
                    path={mdiPlayOutline}
                    size={1}
                />
                <HeaderText>{playbookRunName}</HeaderText>
                <Icon
                    path={mdiCircleSmall}
                    size={1}
                />
                <Icon
                    path={mdiCheckAll}
                    size={1}
                />
                <HeaderText>{checklistTitle}</HeaderText>
            </Header>
            <Body>
                <ItemComponent
                    checklistItem={item}
                    playbookRunId={playbookRunId}
                    checklistNum={checklistNum}
                    dragging={false}
                    collapsibleDescription={true}
                    newItem={false}
                    disabled={false}
                    itemNum={itemNum}
                    onChange={(newState: ChecklistItemState) => setChecklistItemState(playbookRunId, checklistNum, itemNum, newState)}
                />
            </Body>
        </Container>
    );
};

export default Task;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    padding: 10px;
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;
const HeaderText = styled.div`
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-weight: 600;
    margin: 0 4px;
`;

// Necessary hack to use Checklist without DraggableProvider and use HoverMenu
const Body = styled.div`
    &:hover,
    &:focus-within {
        ${HoverMenu} {
            opacity: 1;
        }
    }
`;
