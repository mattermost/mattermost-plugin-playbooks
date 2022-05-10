// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {Toggle as BasicToggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import {ChannelAction, ChannelActionType} from 'src/types/channel_actions';

interface Props {
    enabled: boolean;
    title: string;
    onToggle: () => void;
    editable: boolean;
    children: React.ReactNode;
}

const Action = (props: Props) => {
    const onChange = props.editable ? props.onToggle : () => {/* do nothing */};

    return (
        <Wrapper>
            <Container
                onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    onChange();
                }}
                clickable={props.editable}
            >
                <Title clickable={props.editable}>{props.title}</Title>
                <Toggle
                    isChecked={props.enabled}
                    onChange={() => {/* do nothing, clicking logic lives in Container's onClick */}}
                    disabled={!props.editable}
                />
            </Container>
            {props.enabled &&
            <ChildrenContainer>
                {props.children}
            </ChildrenContainer>
            }
        </Wrapper>
    );
};

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
`;

const Container = styled.div<{clickable: boolean}>`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    cursor: ${({clickable}) => (clickable ? 'pointer' : 'default')};
`;

const Title = styled.label<{clickable: boolean}>`
    font-weight: normal;
    font-size: 14px;
    cursor: ${({clickable}) => (clickable ? 'pointer' : 'default')};
`;

const Toggle = styled(BasicToggle)`
    margin: 0;
`;

const ChildrenContainer = styled.div`
    margin-top: 8px;
`;

export default Action;
