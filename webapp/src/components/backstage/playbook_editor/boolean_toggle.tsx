// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef} from 'react';
import {useDispatch} from 'react-redux';

import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';
import {HelpText} from 'src/components/backstage/playbook_runs/shared';

export interface ConfirmationConfig {
    title: string;
    message: string;
    confirmButtonText: string;
}

interface Props {
    label: string;
    hint?: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    confirmationRequired?: ConfirmationConfig;
}

const BooleanToggle = ({label, hint, value, onChange, disabled, confirmationRequired}: Props) => {
    const dispatch = useDispatch();
    const pendingRef = useRef(false);

    const handleChange = useCallback(() => {
        if (pendingRef.current) {
            return;
        }
        pendingRef.current = true;

        if (!value && confirmationRequired) {
            dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
                show: true,
                title: confirmationRequired.title,
                message: confirmationRequired.message,
                confirmButtonText: confirmationRequired.confirmButtonText,
                onConfirm: () => {
                    onChange(true);
                    pendingRef.current = false;
                },
                onCancel: () => {
                    pendingRef.current = false;
                },
            })));
            return;
        }
        onChange(!value);
        pendingRef.current = false;
    }, [value, confirmationRequired, dispatch, onChange]);

    return (
        <div>
            <Toggle
                disabled={disabled}
                isChecked={value}
                onChange={handleChange}
            >
                {label}
            </Toggle>
            {hint && <HelpText>{hint}</HelpText>}
        </div>
    );
};

export default BooleanToggle;
