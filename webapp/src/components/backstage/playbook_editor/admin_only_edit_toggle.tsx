// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import BooleanToggle from './boolean_toggle';

interface PlaybookLike {
    admin_only_edit?: boolean;
}

interface Props {
    playbook: PlaybookLike;
    isAdmin: boolean;
    onChange: (updated: {admin_only_edit: boolean}) => void;
    disabled?: boolean;
}

const AdminOnlyEditToggle = ({playbook, isAdmin, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    const handleChange = useCallback((value: boolean) => {
        onChange({admin_only_edit: value});
    }, [onChange]);

    const confirmationRequired = useMemo(() => ({
        title: formatMessage({id: 'playbooks.admin_only_edit_toggle.confirm_title', defaultMessage: 'Restrict editing to admins only'}),
        message: formatMessage({id: 'playbooks.admin_only_edit_toggle.confirm', defaultMessage: 'Enabling this will immediately restrict editing to admins only. Non-admin members who currently edit this playbook will lose access. Continue?'}),
        confirmButtonText: formatMessage({id: 'playbooks.admin_only_edit_toggle.confirm_button', defaultMessage: 'Confirm'}),
    }), [formatMessage]);

    if (!isAdmin) {
        return null;
    }

    return (
        <BooleanToggle
            label={formatMessage({id: 'playbooks.admin_only_edit_toggle.label', defaultMessage: 'Only admins can edit this playbook'})}
            value={playbook.admin_only_edit ?? false}
            onChange={handleChange}
            disabled={disabled}
            confirmationRequired={confirmationRequired}
        />
    );
};

export default AdminOnlyEditToggle;
