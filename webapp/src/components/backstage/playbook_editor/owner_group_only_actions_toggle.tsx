// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';
import {LockOutlineIcon} from '@mattermost/compass-icons/components';

import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import {
    AutomationCard,
    AutomationCardSetting,
    AutomationCardTitle,
    AutomationTitle,
} from 'src/components/backstage/playbook_edit/automation/styles';
import {useConfirmModal} from 'src/components/widgets/confirmation_modal';
import {HelpText} from 'src/components/backstage/playbook_runs/shared';

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
    const openConfirmModal = useConfirmModal();
    const pendingRef = useRef(false);

    const confirmationRequired = useMemo(() => ({
        title: formatMessage({defaultMessage: 'Restrict run management to owner only'}),
        message: formatMessage({defaultMessage: 'Enabling this will immediately restrict finishing and restoring runs to the run owner. Reassigning ownership will also be restricted for non-admins. This applies to all active runs of this playbook. System admins keep access, and playbook admins can still reassign ownership. Continue?'}),
        confirmButtonText: formatMessage({defaultMessage: 'Confirm'}),
    }), [formatMessage]);

    const handleChange = useCallback(() => {
        if (pendingRef.current || disabled) {
            return;
        }
        pendingRef.current = true;

        const value = playbook.owner_group_only_actions ?? false;
        if (!value && confirmationRequired) {
            openConfirmModal({
                title: confirmationRequired.title,
                message: confirmationRequired.message,
                confirmButtonText: confirmationRequired.confirmButtonText,
                onConfirm: () => {
                    try {
                        onChange({owner_group_only_actions: true});
                    } finally {
                        pendingRef.current = false;
                    }
                },
                onCancel: () => {
                    pendingRef.current = false;
                },
            });
            return;
        }
        try {
            onChange({owner_group_only_actions: !value});
        } finally {
            pendingRef.current = false;
        }
    }, [playbook.owner_group_only_actions, confirmationRequired, openConfirmModal, onChange, disabled]);

    if (!isPlaybookAdmin) {
        return null;
    }

    return (
        <AutomationCard
            id='run-permissions-settings'
            data-testid='owner-group-only-actions-section'
        >
            <AutomationCardTitle>
                <LockOutlineIcon size={22}/>
                <FormattedMessage defaultMessage='Settings'/>
            </AutomationCardTitle>
            <AutomationCardSetting>
                <FullWidthAutomationTitle data-testid='owner-group-only-actions-toggle'>
                    <Toggle
                        disabled={disabled}
                        isChecked={playbook.owner_group_only_actions ?? false}
                        onChange={handleChange}
                    >
                        <FormattedMessage defaultMessage='Restrict run management actions for non-owners'/>
                    </Toggle>
                </FullWidthAutomationTitle>
                <HelpText>
                    <FormattedMessage defaultMessage='Applies immediately to all active runs of this playbook. System admins keep access, and playbook admins can still reassign ownership.'/>
                </HelpText>
            </AutomationCardSetting>
        </AutomationCard>
    );
};

const FullWidthAutomationTitle = styled(AutomationTitle)`
    width: 100%;

    label {
        width: 100%;
    }
`;

export default OwnerGroupOnlyActionsToggle;
