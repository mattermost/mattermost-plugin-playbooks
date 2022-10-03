// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {Modal} from 'react-bootstrap';

import styled from 'styled-components';

import {LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';

import GenericModal, {ModalSubheading, DefaultFooterContainer} from 'src/components/widgets/generic_modal';

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
            <div>
                {props.title}
                <ModalSubheading>
                    {props.subtitle}
                </ModalSubheading>
            </div>
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
            autoCloseOnConfirmButton={false}
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
    }
`;

const StyledModal = styled(GenericModal)`
    .modal-body {
        :before {
            content: '';
            height: 1px;
            width: 600px;
            position: absolute;
            left: -24px;
            top: 0px;
            background: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }
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

const renderThumbVertical = ({style, ...props}: any) => (
    <div
        {...props}
        style={{
            ...style,
            width: '4px',
            background: 'var(--center-channel-color)',
            opacity: '0.24',
            borderRadius: '4px',
            position: 'fixed',
            right: '8px',
        }}
    />
);

const renderTrackVertical = ({style, ...props}: any) => (
    <div
        {...props}
        style={{
            ...style,
            paddingTop: '8px',
            paddingBottom: '8px',

            // The following three props are needed to actually render the track;
            // without them, the scrollbar disappears
            height: '100%',
            top: '0',
            right: '0',
        }}
    />
);

const Header = styled.div`
    display: flex;
    flex-direction: row;
`;

const IconWrapper = styled.div`
    margin-right: 14px;
    margin-top: 2px;
`;

export const TriggersContainer = styled.div`
    display: flex;
    flex-direction: column;
    row-gap: 16px;
`;

export const ActionsContainer = styled.div`
    display: flex;
    flex-direction: column;
    row-gap: 20px;
`;

export default ActionsModal;
