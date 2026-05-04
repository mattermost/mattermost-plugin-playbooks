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
        message: formatMessage({defaultMessage: 'Enabling this will immediately restrict finishing, restoring, and reassigning ownership of runs to the run owner only. This applies to all active runs of this playbook. Playbook admins and system admins retain access. Continue?'}),
        confirmButtonText: formatMessage({defaultMessage: 'Confirm'}),
    }), [formatMessage]);

    if (!isPlaybookAdmin) {
        return null;
    }

    return (
        <BooleanToggle
            label={formatMessage({defaultMessage: 'Only the run owner can finish, restore, or reassign runs'})}
            hint={formatMessage({defaultMessage: 'Applies immediately to all active runs of this playbook. Playbook admins and system admins retain access.'})}
            value={playbook.owner_group_only_actions ?? false}
            onChange={handleChange}
            disabled={disabled}
            confirmationRequired={confirmationRequired}
        />
    );
};

export default OwnerGroupOnlyActionsToggle;
