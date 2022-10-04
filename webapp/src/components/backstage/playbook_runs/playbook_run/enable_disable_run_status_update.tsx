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
        const confirmationMessage = formatMessage({defaultMessage: 'Are you sure you want to {status} status update for this run?'}, {status});

        const onConfirm = async () => {
            await runStatusUpdate(playbookRun.id, status);
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: formatMessage({defaultMessage: 'Confirm {status} status update'}, {status}),
            message: confirmationMessage,
            confirmButtonText: formatMessage({defaultMessage: 'Ok'}),
            onConfirm,
            onCancel: () => null,
        })));
    };
};
