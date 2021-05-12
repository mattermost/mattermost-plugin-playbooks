// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import styled from 'styled-components';

import {
    AutomationHeader,
    AutomationTitle,
} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';

// @ts-ignore
const AutocompleteTextbox = window.Components.Textbox;

const AutocompleteWrapper = styled.div`
    flex-grow: 1;
    width: 300px;
    max-height: 300px;

    .custom-textarea {
        transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;
        width: 100%;
        resize: none;
        min-height: 150px;
        max-height: 260px;
        overflow-y: auto;
        background-color: rgb(var(--center-channel-bg-rgb));
        border: none;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        border-radius: 4px;
        padding: 16px 16px 0 16px;
        font-size: 14px;
        line-height: 20px;

        &:focus {
            box-shadow: inset 0 0 0 2px var(--button-bg);
        }

        &:disabled {
            background-color: rgb(var(--center-channel-bg-rgb), 0.16) !important;
            color: rgb(var(--center-channel-color-rgb), 0.7) !important;
        }
    }
`;

const StyledAutomationHeader = styled(AutomationHeader)`
    align-items: start;
`;

interface Props {
    enabled: boolean;
    onToggle: () => void;
    message: string;
    onChange: (message: string) => void;
}

export const MessageOnJoin = (props: Props) => {
    const textboxRef = useRef(null);

    return (
        <StyledAutomationHeader>
            <AutomationTitle>
                <Toggle
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                />
                <div>{'Send a welcome message'}</div>
            </AutomationTitle>
            <AutocompleteWrapper>
                <AutocompleteTextbox
                    ref={textboxRef}
                    createMessage={'Welcome message'}
                    onChange={(e: React.FormEvent<HTMLInputElement>) => {
                        if (e.target) {
                            const input = e.target as HTMLInputElement;
                            props.onChange(input.value);
                        }
                    }}
                    suggestionListStyle={'top'}
                    type={'text'}
                    value={props.message}
                    disabled={!props.enabled}

                    // the following are required props but aren't used
                    characterLimit={256}
                    onKeyPress={() => true}
                    openWhenEmpty={true}
                />
            </AutocompleteWrapper>
        </StyledAutomationHeader>
    );
};
