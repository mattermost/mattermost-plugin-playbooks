// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {PlaybookRun} from 'src/types/playbook_run';
import {runStatusUpdate} from 'src/client';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';

export const useEnableOrDisableRunStatusUpdate = (playbookRun: PlaybookRun) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    return (status:'enable' | 'disable') => {
        const confirmTitle = status === 'enable' ? formatMessage({defaultMessage: 'Confirm enable status update'}) : formatMessage({defaultMessage: 'Confirm disable status update'});
        const confirmationMessage = status === 'enable' ? formatMessage({defaultMessage: 'Are you sure you want to enable status update for this run?'}) : formatMessage({defaultMessage: 'Are you sure you want to disable status update for this run?'});

        const onConfirm = async () => {
            await runStatusUpdate(playbookRun.id, status);
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: confirmTitle,
            message: confirmationMessage,
            confirmButtonText: formatMessage({defaultMessage: 'Ok'}),
            onConfirm,
            onCancel: () => null,
        })));
    };
};
