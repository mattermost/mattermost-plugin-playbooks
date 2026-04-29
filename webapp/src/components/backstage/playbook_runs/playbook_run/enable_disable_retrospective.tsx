// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {useAppDispatch} from 'src/hooks/redux';

import {PlaybookRun} from 'src/types/playbook_run';
import {toggleRunRetrospective} from 'src/client';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';
import {useToaster} from 'src/components/backstage/toast_banner';

export const useToggleRunRetrospective = (playbookRun: PlaybookRun) => {
    const dispatch = useAppDispatch();
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();

    return useCallback((enabled: boolean) => {
        const confirmTitle = enabled ? formatMessage({defaultMessage: 'Confirm enable retrospective'}) : formatMessage({defaultMessage: 'Confirm disable retrospective'});
        const confirmationMessage = enabled ? formatMessage({defaultMessage: 'Are you sure you want to enable the retrospective for this run?'}) : formatMessage({defaultMessage: 'Are you sure you want to disable the retrospective for this run? No retrospective reminder will be sent.'});

        const onConfirm = async () => {
            const result = await toggleRunRetrospective(playbookRun.id, enabled);
            if (result && 'error' in result) {
                addToast({content: formatMessage({defaultMessage: 'Failed to update retrospective setting'})});
            }
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: confirmTitle,
            message: confirmationMessage,
            confirmButtonText: enabled ? formatMessage({defaultMessage: 'Enable retrospective'}) : formatMessage({defaultMessage: 'Disable retrospective'}),
            onConfirm,
            onCancel: () => null,
        })));
    }, [playbookRun.id, dispatch, formatMessage, addToast]);
};
