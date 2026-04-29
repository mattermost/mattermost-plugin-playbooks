// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import {useConfirmModal} from 'src/components/widgets/confirmation_modal';

export interface ConfirmationConfig {
    title: string;
    message: string;
    confirmButtonText: string;
}

interface Props {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    confirmationRequired?: ConfirmationConfig;
    testId?: string;
}

const BooleanToggle = ({label, value, onChange, disabled, confirmationRequired, testId}: Props) => {
    const openConfirmModal = useConfirmModal();

    const handleChange = useCallback(() => {
        if (!value && confirmationRequired) {
            openConfirmModal({
                title: confirmationRequired.title,
                message: confirmationRequired.message,
                confirmButtonText: confirmationRequired.confirmButtonText,
                onConfirm: () => onChange(true),
            });
            return;
        }
        onChange(!value);
    }, [value, confirmationRequired, openConfirmModal, onChange]);

    return (
        <div data-testid={testId}>
            <Toggle
                disabled={disabled}
                isChecked={value}
                onChange={handleChange}
            >
                {label}
            </Toggle>
        </div>
    );
};

export default BooleanToggle;
