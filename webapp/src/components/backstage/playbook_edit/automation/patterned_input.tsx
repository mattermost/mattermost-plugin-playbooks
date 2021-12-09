// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled, {css} from 'styled-components';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/playbook_edit/automation/styles';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';

interface Props {
    enabled: boolean;
    disableToggle?: boolean;
    onToggle: () => void;
    textOnToggle: string;
    placeholderText: string;
    errorText: string;
    input: string;
    type: string;
    pattern: string;
    onChange: (updatedInput: string) => void;
    maxLength?: number;
}

export const PatternedInput = (props: Props) => (
    <AutomationHeader>
        <AutomationTitle>
            <Toggle
                isChecked={props.enabled}
                disabled={props.disableToggle}
                onChange={props.onToggle}
            />
            <div>{props.textOnToggle}</div>
        </AutomationTitle>
        <SelectorWrapper>
            <TextBox
                disabled={!props.enabled}
                type={props.type}
                required={true}
                value={props.enabled ? props.input : ''}
                onChange={(e) => props.onChange(e.target.value)}
                pattern={props.pattern}
                placeholder={props.placeholderText}
                maxLength={props.maxLength}
            />
            <ErrorMessage>
                {props.errorText}
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
    disabled: boolean;
}

const TextBox = styled.input<TextBoxProps>`
    ::placeholder {
        color: var(--center-channel-color);
        opacity: 0.64;
    }

    height: 40px;
    width: 100%;

    background-color: ${(props) => (props.disabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};
    color: var(--center-channel-color);
    border-radius: 4px;
    border: none;
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    font-size: 14px;
    padding-left: 16px;
    padding-right: 16px;

    ${(props) => !props.disabled && props.value && css`
        :invalid:not(:focus) {
            box-shadow: inset 0 0 0 1px var(--error-text);

            & + ${ErrorMessage} {
                display: inline-block;
            }
        }
    `}
`;

