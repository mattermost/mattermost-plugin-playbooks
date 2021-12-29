// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import GenericModal, {DefaultFooterContainer} from 'src/components/widgets/generic_modal';

interface Props {
    show: boolean;
    title: React.ReactNode;
    message: React.ReactNode;
    confirmButtonText?: React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmModalLight = ({show, title, message, confirmButtonText, onConfirm, onCancel}: Props) => {
    return (
        <ConfirmModal
            id={'Confirm-modal-light'}
            show={show}
            confirmButtonText={confirmButtonText}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={true}
            handleConfirm={onConfirm}
            handleCancel={onCancel}
            onHide={onCancel}
            components={{FooterContainer: ConfirmModalFooter}}
        >
            <ConfirmModalTitle>
                {title}
            </ConfirmModalTitle>
            <ConfirmModalMessage>
                {message}
            </ConfirmModalMessage>
        </ConfirmModal>
    );
};

const ConfirmModal = styled(GenericModal)`
    width: 512px;
`;

const ConfirmModalTitle = styled.h1`
    font-family: Metropolis;
    font-size: 22px;
    line-height: 28px;

    text-align: center;
    color: var(--center-channel-color);
`;

const ConfirmModalMessage = styled.div`
    font-size: 14px;
    text-align: center;

    padding: 0 16px;
    margin: 0;
    margin-top: 8px;
    margin-bottom: 12px;
`;

const ConfirmModalFooter = styled(DefaultFooterContainer)`
    align-items: center;
    margin-bottom: 24px;
`;

export default ConfirmModalLight;
