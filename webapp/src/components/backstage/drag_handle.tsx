import React, {FC, useState} from 'react';
import styled from 'styled-components';
import {DraggableProvided} from 'react-beautiful-dnd';

const HandleContainer = styled.div`
    display: flex;
    direction: row;
    margin-top: 12px;
`;

const ClickableI = styled.i`
    cursor: pointer;
`;

interface HandleProps {
    show: boolean;
}

const Handle = styled.div<HandleProps>`
    visibility: ${(props) => (props.show ? 'visible' : 'hidden')};
`;

const Content = styled.div`
    flex-grow: 1;
`;

export interface DragHandleProps {
    children: React.ReactNode;
    draggableProvided: DraggableProvided;
    onDelete: () => void
}

const DragHandle: FC<DragHandleProps> = (props: DragHandleProps) => {
    const [hover, setHover] = useState(false);

    return (
        <HandleContainer
            ref={props.draggableProvided.innerRef}
            {...props.draggableProvided.draggableProps}
            onMouseOver={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <Handle
                show={hover}
                {...props.draggableProvided.dragHandleProps}
            >
                <i
                    className='icon icon-menu'
                />
            </Handle>
            <Content>
                {props.children}
            </Content>
            <Handle
                show={hover}
                onClick={props.onDelete}
            >
                <ClickableI
                    className='icon icon-trash-can-outline'
                />
            </Handle>
        </HandleContainer>
    );
};

export default DragHandle;
