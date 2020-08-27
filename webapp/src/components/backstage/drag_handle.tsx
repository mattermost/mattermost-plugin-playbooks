import React, {FC, useState} from 'react';
import styled from 'styled-components';
import {DraggableProvided} from 'react-beautiful-dnd';

interface HandleProps {
    show: boolean;
}

const HandleContainer = styled.div`
    display: flex;
    align-items: flex-start;
    margin: 24px 0 0;

    &.HandleContainer--Step {
        margin: 16px -32px 0;
    }
`;

const ClickableI = styled.i`
    cursor: pointer;
`;

const Handle = styled.div<HandleProps>`
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    visibility: ${(props) => (props.show ? 'visible' : 'hidden')};
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin: 0 8px 0 0;

    &:first-child {
        margin: 0 0 0 8px;
    }

    &:hover {
        color: var(--center-channel-color);
    }
`;

const Content = styled.div`
    flex-grow: 1;
`;

export interface DragHandleProps {
    step: boolean;
    children: React.ReactNode;
    draggableProvided: DraggableProvided;
    onDelete: () => void
}

const DragHandle: FC<DragHandleProps> = (props: DragHandleProps) => {
    const [hover, setHover] = useState(false);

    return (
        <HandleContainer
            className={props.step ? 'HandleContainer--Step' : ''}
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
