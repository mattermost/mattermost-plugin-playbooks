// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {Toggle as BasicToggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import ActionChildren from 'src/components/actions_modal_action_children';
import {ChannelAction, ChannelActionType} from 'src/types/channel_actions';

interface Props {
    action: ChannelAction;
    onUpdate: (update: (prevActions: Record<string, ChannelAction>) => Record<string, ChannelAction>) => void;
    editable: boolean;
}

const Action = (props: Props) => {
    const {formatMessage} = useIntl();

    const onToggle = () => props.onUpdate((prevActions: Record<string, ChannelAction>) => ({
        ...prevActions,
        [props.action.action_type]: {
            ...prevActions[props.action.action_type],
            enabled: !prevActions[props.action.action_type].enabled,
        },
    }));

    const onChange = props.editable ? onToggle : () => {/* do nothing */};

    const titles: Record<string, string> = {
        [ChannelActionType.WelcomeMessage]: formatMessage({defaultMessage: 'Send an ephemeral welcome message to the user'}),
    };

    return (
        <Wrapper>
            <Container
                onClick={onChange}
                clickable={props.editable}
            >
                <Title clickable={props.editable}>{titles[props.action.action_type]}</Title>
                <Toggle
                    isChecked={props.action.enabled}
                    onChange={onChange}
                    disabled={!props.editable}
                />
            </Container>
            {props.action.enabled &&
            <ChildrenContainer>
                <ActionChildren {...props}/>
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
    margin-top: 12px;
`;

export default Action;
