// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useEffect, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import GenericModal, {InlineLabel} from 'src/components/widgets/generic_modal';
import {BaseInput} from 'src/components/assets/inputs';
import {useRun} from 'src/hooks';
import {useUpdateRun} from 'src/graphql/hooks';

const ID = 'playbook_run_update';

type Props = {
    playbookRunId: string;
    field: 'name' | 'channel_id';
} & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: UpdateRunModal,
    dialogProps: props,
});

const UpdateRunModal = ({
    playbookRunId,
    field,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const [channelId, setChannelId] = useState('');
    const [name, setName] = useState('');
    const [run] = useRun(playbookRunId);
    const updateRun = useUpdateRun(playbookRunId);

    useEffect(() => {
        if (run) {
            setChannelId(run.channel_id);
        }
    }, [run, run?.channel_id]);

    useEffect(() => {
        if (run) {
            setName(run.name);
        }
    }, [run, run?.name]);

    const onSubmit = () => {
        if (field === 'name') {
            updateRun({name});
        }

        // updateRun({channel_id: channelId});
    };

    const isFormValid = true;

    return (
        <StyledGenericModal
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Update'})}
            showCancel={true}
            isConfirmDisabled={!isFormValid}
            handleConfirm={onSubmit}
            id={ID}
            modalHeaderText={formatMessage({defaultMessage: 'Update run'})}
            {...modalProps}
        >
            {field === 'name' && (
                <Body>
                    <InlineLabel>{formatMessage({defaultMessage: 'Run name'})}</InlineLabel>
                    <BaseInput
                        data-testid={'run-name-input'}
                        autoFocus={true}
                        type={'text'}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </Body>
            )}
        </StyledGenericModal>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        h1 {
            width:100%;
        }
        .modal-header {
            padding: 24px 31px;
            margin-bottom: 0;
            box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
        }
        .modal-content {
            padding: 0px;
        }
        .modal-body {
            padding: 24px 31px;
        }
        .modal-footer {
           box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
           padding: 0 31px 28px 31px;
        }
    }
`;

const Body = styled.div`
    display: flex;
    flex-direction: column;
    & > div, & > input {
        margin-bottom: 12px;
    }
`;

export default UpdateRunModal;
