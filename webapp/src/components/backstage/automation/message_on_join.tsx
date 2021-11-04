// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {FormattedMessage} from 'react-intl';

import {StyledMarkdownTextbox} from 'src/components/backstage/styles';

import {
    AutomationHeader,
    AutomationTitle,
} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';

const TextboxWrapper = styled.div`
    margin-top: 2rem;
    width: 100%;
`;

const StyledAutomationHeader = styled(AutomationHeader)`
    align-items: start;
    flex-direction: column;
`;

interface Props {
    enabled: boolean;
    onToggle: () => void;
    message: string;
    onChange: (message: string) => void;
}

export const MessageOnJoin = (props: Props) => {
    return (
        <StyledAutomationHeader>
            <AutomationTitle>
                <Toggle
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                />
                <div><FormattedMessage defaultMessage='Send a welcome message'/></div>
            </AutomationTitle>
            {props.enabled && (
                <TextboxWrapper>
                    <StyledMarkdownTextbox
                        className={'playbook_welcome_message'}
                        id={'playbook_welcome_message'}
                        placeholder={'Welcome message'}
                        value={props.message}
                        setValue={props.onChange}
                    />
                </TextboxWrapper>
            )}
        </StyledAutomationHeader>
    );
};
