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
    onChange: (updated: {new_channel_only: boolean}) => void;
    disabled?: boolean;
}

const NewChannelOnlyToggle = ({playbook, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    const handleChange = useCallback((value: boolean) => {
        onChange({new_channel_only: value});
    }, [onChange]);

    const label = formatMessage({defaultMessage: 'Require new channel for all runs'});
    const confirmationRequired = useMemo(() => ({
        title: label,
        message: formatMessage({defaultMessage: 'Enabling this will prevent runs from linking to existing channels. All future runs will create a new channel. Continue?'}),
        confirmButtonText: formatMessage({defaultMessage: 'Confirm'}),
    }), [label, formatMessage]);

    return (
        <BooleanToggle
            label={label}
            value={playbook.new_channel_only ?? false}
            onChange={handleChange}
            disabled={disabled}
            confirmationRequired={confirmationRequired}
            testId='new-channel-only-toggle'
        />
    );
};

export default NewChannelOnlyToggle;
