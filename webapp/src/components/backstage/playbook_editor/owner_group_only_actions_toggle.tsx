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
        title: formatMessage({id: 'playbooks.owner_group_only_actions_toggle.confirm_title', defaultMessage: 'Restrict finishing runs to owner only'}),
        message: formatMessage({id: 'playbooks.owner_group_only_actions_toggle.confirm', defaultMessage: 'Enabling this will immediately restrict finishing runs to the run owner only. This applies to all active runs of this playbook. System admins can always finish runs. Continue?'}),
        confirmButtonText: formatMessage({id: 'playbooks.owner_group_only_actions_toggle.confirm_button', defaultMessage: 'Confirm'}),
    }), [formatMessage]);

    if (!isPlaybookAdmin) {
        return null;
    }

    return (
        <BooleanToggle
            label={formatMessage({id: 'playbooks.owner_group_only_actions_toggle.label', defaultMessage: 'Only the run owner can finish runs'})}
            hint={formatMessage({id: 'playbooks.owner_group_only_actions_toggle.hint', defaultMessage: 'Applies immediately to all active runs of this playbook. System admins can always finish runs.'})}
            value={playbook.owner_group_only_actions ?? false}
            onChange={handleChange}
            disabled={disabled}
            confirmationRequired={confirmationRequired}
        />
    );
};

export default OwnerGroupOnlyActionsToggle;
