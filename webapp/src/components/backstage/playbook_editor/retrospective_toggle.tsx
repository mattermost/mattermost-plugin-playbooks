// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';

interface PlaybookLike {
    retrospective_enabled?: boolean;
    retrospective_reminder_interval_seconds: number;
}

interface Props {
    playbook: PlaybookLike;
    onChange: (updated: {retrospective_enabled: boolean}) => void;
    disabled: boolean;
}

const RetrospectiveToggle = ({playbook, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    const retroEnabled = playbook.retrospective_enabled ?? false;

    const handleChange = useCallback(() => {
        onChange({retrospective_enabled: !retroEnabled});
    }, [onChange, retroEnabled]);

    return (
        <Toggle
            isChecked={retroEnabled}
            disabled={disabled}
            onChange={handleChange}
        >
            {formatMessage({id: 'playbooks.retrospective_toggle.enable_label', defaultMessage: 'Enable retrospective'})}
            {retroEnabled && (
                <span data-testid='retrospective-reminder-interval'>
                    {formatMessage(
                        {id: 'playbooks.retrospective_toggle.reminder_interval', defaultMessage: ' (reminder every {hours}h)'},
                        {hours: Math.round(playbook.retrospective_reminder_interval_seconds / 3600)},
                    )}
                </span>
            )}
        </Toggle>
    );
};

export default RetrospectiveToggle;
