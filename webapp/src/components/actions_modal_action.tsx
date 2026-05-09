// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {Toggle as BasicToggle} from 'src/components/backstage/playbook_edit/automation/toggle';

interface Props {
    enabled: boolean;
    title: string;
    onToggle: () => void;
    editable: boolean;
    children?: React.ReactNode;
    id?: string;

    // Optional hint rendered inside the action's data-testid wrapper.
    // Use for "why is this disabled" messaging so it stays in the same
    // accessibility/test scope as the toggle it explains.
    hint?: React.ReactNode;
}

const Action = (props: Props) => {
    const onChange = props.editable ? props.onToggle : () => {/* do nothing */};

    return (
        <Wrapper data-testid={props.id}>
            <Container
                onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    onChange();
                }}
                $clickable={props.editable}
            >
                <Title $clickable={props.editable}>{props.title}</Title>
                <Toggle
                    disabled={!props.editable}
                    isChecked={props.enabled}
                    onChange={() => {/* do nothing, clicking logic lives in Container's onClick */}}
                />
            </Container>
            {props.hint && <Hint>{props.hint}</Hint>}
            {props.enabled && props.children &&
                <ChildrenContainer>{props.children}</ChildrenContainer>
            }
        </Wrapper>
    );
};

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
`;

const Container = styled.div<{$clickable: boolean}>`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    cursor: ${({$clickable}) => ($clickable ? 'pointer' : 'default')};
`;

const Title = styled.label<{$clickable: boolean}>`
    cursor: ${({$clickable}) => ($clickable ? 'pointer' : 'default')};
    font-size: 14px;
    font-weight: normal;
`;

const Toggle = styled(BasicToggle)`
    margin: 0;
`;

const ChildrenContainer = styled.div`
    margin-top: 8px;
`;

const Hint = styled.div`
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.48);
    font-size: 12px;
    font-style: italic;
`;

export default Action;
