// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {Modal} from 'react-bootstrap';

import {clientRenameChecklist} from 'src/client';
import {FormContainer, ModalField} from 'src/components/assets/modal';
import GenericModal from 'src/components/widgets/generic_modal';

interface Props {
    playbookRunID: string;
    checklistNumber: number;
    initialTitle: string;
    show: boolean;
    onHide: () => void;
}

const RenameChecklistDialog = ({playbookRunID, checklistNumber, initialTitle, show, onHide}: Props) => {
    const {formatMessage} = useIntl();
    const [title, setTitle] = useState(initialTitle);

    useEffect(() => {
        setTitle(initialTitle);
    }, [initialTitle]);

    const onConfirm = () => {
        clientRenameChecklist(playbookRunID, checklistNumber, title);
    };

    return (
        <GenericModal
            id={'renameChecklistDialog'}
            show={show}
            modalHeaderText={formatMessage({defaultMessage: 'Rename checklist'})}
            onHide={onHide}
            confirmButtonText={formatMessage({defaultMessage: 'Rename'})}
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

export default RenameChecklistDialog;
