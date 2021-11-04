// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {AutomationHeader, AutomationTitle} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';

interface Props {
    enabled : boolean;
    onToggle: () => void;
}

export const CategorizePlaybookRun = (props: Props) => (
    <AutomationHeader>
        <AutomationTitle>
            <Toggle
                isChecked={props.enabled}
                onChange={props.onToggle}
            />
            <div><FormattedMessage defaultMessage='Add the channel to a sidebar category'/></div>
        </AutomationTitle>
    </AutomationHeader>
);
