// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState} from 'react';

import styled, {css} from 'styled-components';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';

interface Props {
    enabled: boolean;
    onToggle: () => void;
    textOnToggle: string;
    placeholderText: string;
    errorText: string;
    input: string;
    pattern: string;
    delimiter?: string;
    onChange: (updatedInput: string) => void;
    maxLength?: number;
    rows?: number;
    maxRows?: number;
    maxErrorText?: string;
}

export const PatternedTextArea: FC<Props> = (props: Props) => {
    const [invalid, setInvalid] = useState<boolean>(false);
    const [errorText, setErrorText] = useState<string>(props.errorText);
    const handleOnBlur = (urls: string) => {
        if (!props.enabled) {
            setInvalid(false);
            return;
        }

        if (props.maxRows && urls.length > props.maxRows) {
            setInvalid(true);
            if (props.maxErrorText) {
                setErrorText(props.maxErrorText);
            }
            return;
        }

        if (!isPatternValid(urls, props.pattern, props.delimiter)) {
            setInvalid(true);
            setErrorText(props.errorText);
            return;
        }

        setInvalid(false);
    };

    return (
        <AutomationHeader>
            <AutomationTitle>
                <Toggle
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                />
                <div>{props.textOnToggle}</div>
            </AutomationTitle>
            <SelectorWrapper>
                <TextArea
                    enabled={props.enabled}
                    required={true}
                    rows={props.rows}
                    value={props.enabled ? props.input : ''}
                    onChange={(e) => props.onChange(e.target.value)}
                    onBlur={(e) => handleOnBlur(e.target.value)}
                    placeholder={props.placeholderText}
                    maxLength={props.maxLength}
                    invalid={invalid}
                />
                <ErrorMessage>
                    {errorText}
                </ErrorMessage>
            </SelectorWrapper>
        </AutomationHeader>
    );
};

const isPatternValid = (value: string, pattern: string, delimiter = '\n'): boolean => {
    const regex = new RegExp(pattern);
    const trimmed = value.split(delimiter).filter((v) => v.trim().length);
    const invalid = trimmed.filter((v) => !regex.test(v));
    return invalid.length === 0;
};

const ErrorMessage = styled.div`
    color: var(--error-text);
    margin-left: auto;
    display: none;
`;

interface TextAreaProps {
    enabled: boolean;
    invalid: boolean;
}

const TextArea = styled.textarea<TextAreaProps>`
    ::placeholder {
        color: var(--center-channel-color);
        opacity: 0.64;
    }

    height: auto;
    width: 100%;

    background-color: ${(props) => (props.enabled ? 'var(--center-channel-bg)' : 'rgba(var(--center-channel-bg-rgb), 0.16)')};
    color: var(--center-channel-color);
    border-radius: 4px;
    border: none;
    box-shadow: inset 0 0 0 1px var(--center-channel-color-16);
    font-size: 14px;
    padding-left: 16px;
    padding-right: 16px;
    resize: ${(props) => !props.enabled && 'none'};

    ${(props) => props.invalid && props.enabled && props.value && css`
        :not(:focus) {
            box-shadow: inset 0 0 0 1px var(--error-text);
            & + ${ErrorMessage} {
                display: inline-block;
            }
        }
    `}
`;
