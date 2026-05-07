// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import BooleanToggle from './boolean_toggle';

interface PlaybookLike {
    owner_group_only_actions?: boolean;
}

interface Props {
    playbook: PlaybookLike;
    isPlaybookAdmin: boolean;
    onChange: (updated: {owner_group_only_actions: boolean}) => void;
    disabled?: boolean;
}

const OwnerGroupOnlyActionsToggle = ({playbook, isPlaybookAdmin, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    const handleChange = useCallback((value: boolean) => {
        onChange({owner_group_only_actions: value});
    }, [onChange]);

    const confirmationRequired = useMemo(() => ({
        title: formatMessage({defaultMessage: 'Restrict run management to owner only'}),
        message: formatMessage({defaultMessage: 'Enabling this will immediately restrict finishing and restoring runs to the run owner. Reassigning ownership will also be restricted for non-admins. This applies to all active runs of this playbook. System admins keep access, and playbook admins can still reassign ownership. Continue?'}),
        confirmButtonText: formatMessage({defaultMessage: 'Confirm'}),
    }), [formatMessage]);

    if (!isPlaybookAdmin) {
        return null;
    }

    return (
        <BooleanToggle
            label={formatMessage({defaultMessage: 'Restrict run management actions for non-owners'})}
            hint={formatMessage({defaultMessage: 'Applies immediately to all active runs of this playbook. System admins keep access, and playbook admins can still reassign ownership.'})}
            value={playbook.owner_group_only_actions ?? false}
            onChange={handleChange}
            disabled={disabled}
            confirmationRequired={confirmationRequired}
        />
    );
};

export default OwnerGroupOnlyActionsToggle;
