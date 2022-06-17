import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {PlaybookRun} from 'src/types/playbook_run';
import {outstandingTasks} from 'src/components/modals/update_run_status_modal';
import {finishRun} from 'src/client';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';

interface WithFinishRun {
    playbookRun: PlaybookRun;
    children?: React.ReactNode;
}

export default function withFinishRun<T extends WithFinishRun>(ChildComponent: React.ComponentType<T>) {
    return (props: T) => {
        const dispatch = useDispatch();
        const {formatMessage} = useIntl();

        const onFinishRunClick = () => {
            const outstanding = outstandingTasks(props.playbookRun.checklists);
            let confirmationMessage = formatMessage({defaultMessage: 'Are you sure you want to finish the run?'});
            if (outstanding > 0) {
                confirmationMessage = formatMessage(
                    {defaultMessage: 'There {outstanding, plural, =1 {is # outstanding task} other {are # outstanding tasks}}. Are you sure you want to finish the run?'},
                    {outstanding}
                );
            }

            const onConfirm = () => {
                finishRun(props.playbookRun.id);
            };

            dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
                show: true,
                title: formatMessage({defaultMessage: 'Confirm finish run'}),
                message: confirmationMessage,
                confirmButtonText: formatMessage({defaultMessage: 'Finish run'}),
                onConfirm,
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                onCancel: () => {},
            })));
        };

        return (
            <ChildComponent
                {...props}
                onClick={onFinishRunClick}
            />
        );
    };
}
