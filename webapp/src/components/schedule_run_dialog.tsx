// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useState} from 'react';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

import {scheduleRun} from 'src/client';
import {BaseInput} from 'src/components/assets/inputs';
import GenericModal, {InlineLabel} from 'src/components/widgets/generic_modal';

import {ScheduledRun} from 'src/types/playbook_run';

const ID = 'playbooks_schedule_run_dialog';

export const makeScheduleRunDialog = (props: Props) => ({
    modalId: ID,
    dialogType: ScheduleRunDialog,
    dialogProps: props,
});

type Props = {
    scheduledRun: ScheduledRun | null;
    setScheduledRun: (createdRun: ScheduledRun | null) => void;
    playbook: {id: string, title: string};
} & Partial<ComponentProps<typeof GenericModal>>;

const ScheduleRunDialog = ({scheduledRun, setScheduledRun, playbook, ...modalProps}: Props) => {
    const {formatMessage} = useIntl();

    const [runName, setRunName] = useState(scheduledRun?.run_name || '');

    return (
        <DialogModal
            id={ID}
            confirmButtonText={formatMessage({defaultMessage: 'Schedule Run'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={true}
            handleConfirm={() => {
                scheduleRun(playbook.id, runName).then(setScheduledRun);
            }}
            handleCancel={() => {/**/}}
            onHide={() => {/**/}}
            isConfirmDisabled={runName === ''}
            {...modalProps}
        >
            <Title>
                {formatMessage({defaultMessage: 'Schedule Playbook Runs'})}
            </Title>
            <Form>
                <InlineLabel>{formatMessage({defaultMessage: 'Run name'})}</InlineLabel>
                <BaseInput
                    autoFocus={true}
                    type={'text'}
                    value={runName}
                    onChange={(e) => setRunName(e.target.value)}
                />
                <PlaybookName>{`Playbook: ${playbook.title}`}</PlaybookName>
            </Form>
        </DialogModal>
    );
};

const DialogModal = styled(GenericModal)`
    width: 600px;
`;

const Title = styled.h1`
    font-family: Metropolis;
    font-size: 22px;
    margin-bottom: 28px;

    color: var(--center-channel-color);
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
`;

const PlaybookName = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    margin-top: 10px;
`;
