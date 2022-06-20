// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {clientRemoveChecklist} from 'src/client';
import GenericModal, {DefaultFooterContainer} from 'src/components/widgets/generic_modal';

interface Props {
    playbookRunID: string;
    checklistIndex: number;
    show: boolean;
    onHide: () => void;
}

const DeleteChecklistDialog = ({playbookRunID, checklistIndex, show, onHide}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <DeleteModal
            id={'collapsible-checklist-hover-menu-delete-modal'}
            show={show}
            confirmButtonText={formatMessage({defaultMessage: 'Delete'})}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={true}
            handleConfirm={() => clientRemoveChecklist(playbookRunID, checklistIndex)}
            handleCancel={onHide}
            onHide={onHide}
            components={{FooterContainer: DeleteModalFooter}}
            isConfirmDestructive={true}
        >
            <DeleteModalTitle>
                {formatMessage({defaultMessage: 'Delete checklist'})}
            </DeleteModalTitle>
            <DeleteModalContent>
                {formatMessage({defaultMessage: 'Are you sure you want to delete this checklist? It will be removed from this run but will not affect the playbook.'})}
            </DeleteModalContent>
        </DeleteModal>
    );
};

const DeleteModal = styled(GenericModal)`
    width: 512px;
`;

const DeleteModalTitle = styled.h1`
    font-family: Metropolis;
    font-size: 22px;
    line-height: 28px;

    text-align: center;
    color: var(--center-channel-color);
`;

const DeleteModalContent = styled.div`
    font-size: 14px;
    text-align: center;

    padding: 0 16px;
    margin: 0;
    margin-top: 8px;
    margin-bottom: 12px;
`;

const DeleteModalFooter = styled(DefaultFooterContainer)`
    align-items: center;
    margin-bottom: 24px;
`;

export default DeleteChecklistDialog;
