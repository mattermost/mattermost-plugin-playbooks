// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import BooleanToggle from './boolean_toggle';

interface PlaybookLike {
    new_channel_only?: boolean;
}

interface Props {
    playbook: PlaybookLike;
    isPlaybookAdmin: boolean;
    isSystemAdmin?: boolean;
    onChange: (updated: {new_channel_only: boolean}) => void;
    disabled?: boolean;
}

const NewChannelOnlyToggle = ({playbook, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    const handleChange = useCallback((value: boolean) => {
        onChange({new_channel_only: value});
    }, [onChange]);

    const confirmationRequired = useMemo(() => ({
        title: formatMessage({id: 'playbooks.new_channel_only_toggle.confirm_title', defaultMessage: 'Require new channel for all runs'}),
        message: formatMessage({id: 'playbooks.new_channel_only_toggle.confirm_message', defaultMessage: 'Enabling this will prevent runs from linking to existing channels. All future runs will create a new channel. Continue?'}),
        confirmButtonText: formatMessage({id: 'playbooks.new_channel_only_toggle.confirm_button', defaultMessage: 'Confirm'}),
    }), [formatMessage]);

    return (
        <BooleanToggle
            label={formatMessage({id: 'playbooks.new_channel_only_toggle.label', defaultMessage: 'Require new channel for all runs'})}
            value={playbook.new_channel_only ?? false}
            onChange={handleChange}
            disabled={disabled}
            confirmationRequired={confirmationRequired}
        />
    );
};

export default NewChannelOnlyToggle;
