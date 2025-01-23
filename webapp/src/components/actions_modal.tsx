// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {Modal} from 'react-bootstrap';

import styled from 'styled-components';

import {LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';

import GenericModal, {DefaultFooterContainer, ModalSubheading} from 'src/components/widgets/generic_modal';

interface Props {
    id: string;
    title: React.ReactNode;
    subtitle: React.ReactNode;
    show: boolean;
    onHide: () => void;
    editable: boolean;
    onSave: () => void;
    children: React.ReactNode;
    isValid: boolean;
    autoCloseOnConfirmButton?: boolean;
}

const ActionsModal = (props: Props) => {
    const {formatMessage} = useIntl();

    const header = (
        <Header>
            <IconWrapper>
                <LightningBoltOutlineIcon
                    size={24}
                    color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                />
            </IconWrapper>
            <ModalTitle>
                {props.title}
                <ModalSubheading>
                    {props.subtitle}
                </ModalSubheading>
            </ModalTitle>
        </Header>
    );

    // We want to show the confirm button but disabled when is invalid
    const onHandleConfirm = () => {
        if (!props.editable) {
            return null;
        }
        if (!props.isValid) {
            return () => null;
        }
        return props.onSave;
    };

    return (
        <StyledModal
            id={props.id}
            modalHeaderText={header}
            show={props.show}
            onHide={props.onHide}
            onExited={() => {/* do nothing else after the modal has exited */}}
            handleCancel={props.editable ? props.onHide : null}
            handleConfirm={onHandleConfirm()}
            confirmButtonText={formatMessage({defaultMessage: 'Save'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            isConfirmDisabled={!props.editable}
            confirmButtonClassName={props.isValid ? '' : 'disabled'}
            isConfirmDestructive={false}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={props.autoCloseOnConfirmButton ?? false}
            enforceFocus={true}
            components={{
                Header: ModalHeader,
                FooterContainer: ModalFooter,
            }}
        >
            {props.children}
        </StyledModal>
    );
};

const ModalHeader = styled(Modal.Header)`
    &&&& {
        margin-bottom: 0;
        padding-top: 24px;
        padding-bottom: 20px;
    }
`;

const StyledModal = styled(GenericModal)`
    .modal-body {
        border-top: var(--border-default);
    }
`;

const ModalTitle = styled.div`
    font-weight: 600;
    font-size: 20px;
    line-height: 20px;
    margin-top: 4px;
`;

const ModalFooter = styled(DefaultFooterContainer)`
    :after {
        content: '';
        height: 1px;
        width: 100%;
        position: absolute;
        left: 0px;
        margin-top: -24px;

        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    .disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
`;

const IconWrapper = styled.div`
    margin-right: 12px;
    margin-left: -4px;
`;

export const TriggersContainer = styled.div`
    display: flex;
    flex-direction: column;
    row-gap: 16px;
    @media screen and (max-height: 900px) {
        max-height: 500px;
        overflow-x: hidden;
        overflow-y: scroll;
    }
`;

export const ActionsContainer = styled.div`
    display: flex;
    flex-direction: column;
    row-gap: 20px;
`;

export default ActionsModal;
