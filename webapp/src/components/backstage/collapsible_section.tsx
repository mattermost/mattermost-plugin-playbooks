import React, {FC, useState} from 'react';

import styled from 'styled-components';

import HorizontalBar from './horizontal_bar';
import EditableText, {ClickableI} from './editable_text';

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

const CollapsibleSection: FC<CollapsibleSectionProps> = (props: CollapsibleSectionProps) => {
    const [expanded, setExpanded] = useState(true);

    let icon = 'icon-chevron-down';
    if (!expanded) {
        icon = 'icon-chevron-right';
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
