import React, {useState} from 'react';

import styled from 'styled-components';

import HorizontalBar from './horizontal_bar';
import EditableText from './editable_text';

export interface CollapsibleSectionProps {
    title: string
    onTitleChange: (newTitle: string) => void
    children: React.ReactNode
}

const Container = styled.span`
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: var(--center-channel-color);
`;

const ClickableI = styled.i`
    margin: 0 4px 0 0;
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover {
        color: var(--center-channel-color);
    }
`;

const CollapsibleSection = (props: CollapsibleSectionProps) => {
    const [expanded, setExpanded] = useState(true);

    let icon = 'icon-20 icon-chevron-down';
    if (!expanded) {
        icon = 'icon-20 icon-chevron-right';
    }

    return (
        <div>
            <HorizontalBar>
                <ClickableI
                    className={icon}
                    onClick={() => setExpanded(!expanded)}
                />
                <Container>
                    <EditableText
                        text={props.title}
                        onChange={props.onTitleChange}
                    />
                </Container>
            </HorizontalBar>
            {
                expanded ? props.children : null
            }
        </div>
    );
};

export default CollapsibleSection;
