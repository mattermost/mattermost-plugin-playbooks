// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';

import styled, {css} from 'styled-components';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';

interface Props {
    enabled: boolean;
    onToggle: () => void;
    url: string;
    onChange: (url: string) => void;
}

export const Webhook: FC<Props> = (props: Props) => (
    <AutomationHeader>
        <AutomationTitle>
            <Toggle
                isChecked={props.enabled}
                onChange={props.onToggle}
            />
            <div>{'Send outgoing webhook'}</div>
        </AutomationTitle>
        <SelectorWrapper>
            <TextBox
                enabled={props.enabled}
                type={'url'}
                required={true}
                value={props.enabled ? props.url : ''}
                onChange={(e) => props.onChange(e.target.value)}
                pattern={'https?://.*'}
                placeholder={'Enter webhook'}
            />
            <ErrorMessage>
                {'URL is not valid.'}
            </ErrorMessage>
        </SelectorWrapper>
    </AutomationHeader>
);

const ErrorMessage = styled.div`
    color: var(--error-text);
    margin-left: auto;
    display: none;
`;

interface TextBoxProps {
    enabled: boolean;
}

const TextBox = styled.input<TextBoxProps>`
    ::placeholder {
        color: var(--center-channel-color);
        opacity: 0.64;
    }

    height: 100%;
    width: 100%;

    background-color: ${(props) => (props.enabled ? 'var(--center-channel-bg)' : 'rgba(var(--center-channel-bg-rgb), 0.16)')};
    color: var(--center-channel-color);
    border-radius: 4px;
    border: none;
    box-shadow: inset 0 0 0 1px var(--center-channel-color-16);
    font-size: 14px;
    padding-left: 16px;
    padding-right: 16px;

    ${(props) => props.enabled && props.value && css`
        :invalid:not(:focus) {
            box-shadow: inset 0 0 0 1px var(--error-text);

            & + ${ErrorMessage} {
                display: inline-block;
            }
        }
    `}
`;

