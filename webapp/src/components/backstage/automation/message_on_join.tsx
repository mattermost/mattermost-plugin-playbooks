// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    AutomationHeader,
    AutomationTitle,
    SelectorWrapper,
} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';
import {StyledTextarea} from 'src/components/backstage/styles';

interface Props {
    enabled: boolean;
    onToggle: () => void;
    message: string;
    onChange: (url: string) => void;
}

export const MessageOnJoin = (props: Props) => (
    <AutomationHeader>
        <AutomationTitle>
            <Toggle
                isChecked={props.enabled}
                onChange={props.onToggle}
            />
            <div>{'Send a welcome message'}</div>
        </AutomationTitle>
        <SelectorWrapper>
            <StyledTextarea
                disabled={!props.enabled}
                value={props.message}
                onChange={(e) => props.onChange(e.target.value)}
            />
        </SelectorWrapper>
    </AutomationHeader>
);
