// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {Modal} from 'react-bootstrap';

import {ChecklistItem} from 'src/types/playbook';
import {clientAddChecklist} from 'src/client';
import {FormContainer, ModalField} from 'src/components/assets/modal';
import GenericModal from 'src/components/widgets/generic_modal';

// disable all react-beautiful-dnd development warnings
const AddChecklistDialog = ({playbookRunID, show, onHide}: {playbookRunID: string, show: boolean, onHide: () => void}) => {
    const {formatMessage} = useIntl();
    const [title, setTitle] = useState('');

    const onConfirm = () => {
        clientAddChecklist(playbookRunID, {title, items: [] as ChecklistItem[]});
        setTimeout(() => setTitle(''), 300);
    };

    return (
        <GenericModal
            id={'addChecklistDialog'}
            show={show}
            modalHeaderText={formatMessage({defaultMessage: 'Add checklist'})}
            onHide={onHide}
            confirmButtonText={formatMessage({defaultMessage: 'Add'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            handleCancel={onHide}
            handleConfirm={onConfirm}
            components={{Header: AddChecklistDialogHeader}}
            isConfirmDisabled={title === ''}
        >
            <FormContainer>
                <ModalField
                    id={'addChecklistDialogInput'}
                    label={formatMessage({defaultMessage: 'Checklist name'})}
                    value={title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                    autoFocus={true}
                />
            </FormContainer>
        </GenericModal>
    );
};

const AddChecklistDialogHeader = styled(Modal.Header)`
    &&&& {
        margin-bottom: 22px;
    }
`;

export default AddChecklistDialog;
