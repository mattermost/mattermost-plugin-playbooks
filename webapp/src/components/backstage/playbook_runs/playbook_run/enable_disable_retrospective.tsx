// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {useAppDispatch} from 'src/hooks/redux';

import {PlaybookRun} from 'src/types/playbook_run';
import {fetchPlaybookRun, toggleRunRetrospective} from 'src/client';
import {playbookRunUpdated} from 'src/actions';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

export const useToggleRunRetrospective = (playbookRun: PlaybookRun) => {
    const dispatch = useAppDispatch();
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();

    return useCallback((enabled: boolean) => {
        const labels = enabled ? {
            title: formatMessage({defaultMessage: 'Confirm enable retrospective'}),
            message: formatMessage({defaultMessage: 'Are you sure you want to enable the retrospective for this run?'}),
            button: formatMessage({defaultMessage: 'Enable retrospective'}),
        } : {
            title: formatMessage({defaultMessage: 'Confirm disable retrospective'}),
            message: formatMessage({defaultMessage: 'Are you sure you want to disable the retrospective for this run? No retrospective reminder will be sent.'}),
            button: formatMessage({defaultMessage: 'Disable retrospective'}),
        };

        const onConfirm = async () => {
            const errorMsg = formatMessage({defaultMessage: 'Failed to update retrospective setting'});
            try {
                const result = await toggleRunRetrospective(playbookRun.id, enabled);
                if (result && 'error' in result) {
                    addToast({content: errorMsg, toastStyle: ToastStyle.Failure});
                    return;
                }
                const updatedRun = await fetchPlaybookRun(playbookRun.id);
                dispatch(playbookRunUpdated(updatedRun));
            } catch {
                addToast({content: errorMsg, toastStyle: ToastStyle.Failure});
            }
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: labels.title,
            message: labels.message,
            confirmButtonText: labels.button,
            onConfirm,
            onCancel: () => null,
        })));
    }, [playbookRun, dispatch, formatMessage, addToast]);
};
