// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import classNames from 'classnames';
import React from 'react';
import {Modal} from 'react-bootstrap';

type Props = {
    className?: string;
    onHide: () => void;
    modalHeaderText: React.ReactNode;
    show: boolean;
    handleCancel?: () => void;
    handleConfirm?: () => void;
    confirmButtonText?: React.ReactNode;
    confirmButtonClassName?: string;
    cancelButtonText?: React.ReactNode;
    isConfirmDisabled?: boolean;
    id: string;
    autoCloseOnCancelButton?: boolean;
    autoCloseOnConfirmButton?: boolean;
    enforceFocus?: boolean;
    footer?: React.ReactNode;
};

type State = {
    show: boolean;
}

export default class GenericModal extends React.PureComponent<Props, State> {
    static defaultProps: Partial<Props> = {
        id: 'genericModal',
        autoCloseOnCancelButton: true,
        autoCloseOnConfirmButton: true,
        enforceFocus: true,
        show: true,
    };

    public constructor(props: Props) {
        super(props);
        this.state = {show: this.props.show};
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        return {...state, show: props.show};
    }

    onHide = () => {
        this.setState({show: false}, () => {
            // setTimeout(this.props.onHide, 500);
        });
    }

    handleCancel = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (this.props.autoCloseOnCancelButton) {
            this.onHide();
        }
        if (this.props.handleCancel) {
            this.props.handleCancel();
        }
    }

    handleConfirm = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (this.props.autoCloseOnConfirmButton) {
            this.onHide();
        }
        if (this.props.handleConfirm) {
            this.props.handleConfirm();
        }
    }

    render() {
        let confirmButton;
        if (this.props.handleConfirm) {
            let confirmButtonText: React.ReactNode = 'Confirm';
            if (this.props.confirmButtonText) {
                confirmButtonText = this.props.confirmButtonText;
            }

            confirmButton = (
                <button
                    type='submit'
                    className={classNames(`GenericModal__button confirm ${this.props.confirmButtonClassName}`, {
                        disabled: this.props.isConfirmDisabled,
                    })}
                    onClick={this.handleConfirm}
                    disabled={this.props.isConfirmDisabled}
                >
                    {confirmButtonText}
                </button>
            );
        }

        let cancelButton;
        if (this.props.handleCancel) {
            let cancelButtonText: React.ReactNode = 'Cancel';
            if (this.props.cancelButtonText) {
                cancelButtonText = this.props.cancelButtonText;
            }

            cancelButton = (
                <button
                    type='button'
                    className='GenericModal__button cancel'
                    onClick={this.handleCancel}
                >
                    {cancelButtonText}
                </button>
            );
        }

        return (
            <StyledModal
                dialogClassName={classNames('a11y__modal GenericModal', this.props.className)}
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.onHide}
                enforceFocus={this.props.enforceFocus}
                restoreFocus={true}
                role='dialog'
                aria-labelledby={`${this.props.id}_heading`}
                id={this.props.id}
            >
                <Modal.Header
                    className='GenericModal__header'
                    closeButton={true}
                >
                    <ModalHeading id={`${this.props.id}_heading`}>
                        {this.props.modalHeaderText}
                    </ModalHeading>
                </Modal.Header>
                <form>
                    <Modal.Body>
                        {this.props.children}
                    </Modal.Body>
                    <Modal.Footer>
                        <FooterContainer>
                            <Buttons>
                                {cancelButton}
                                {confirmButton}
                            </Buttons>
                            {this.props.footer}
                        </FooterContainer>
                    </Modal.Footer>
                </form>
            </StyledModal>
        );
    }
}

const StyledModal = styled(Modal)`
    &&& {
        /* content-spacing */
        .modal-header {
            margin-bottom: 8px;
        }
        .modal-content {
            padding: 24px;
        }
        .modal-footer {
            padding: 24px 0 0 0;
        }
        .close {
            margin: 12px 12px 0 0;
        }
    }

    &&&& {
        /* control correction-overrides */
        .form-control {
            border: none;
        }
        input.form-control {
            padding-left: 16px;
        }
    }
`;

const Buttons = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
`;

const FooterContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
`;

const ModalHeading = styled.h1`
    font-family: Metropolis;
    font-size: 22px;
    line-height: 28px;
    color: var(--center-channel-color);
`;

export const ModalDescription = styled.p`
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color), 0.72);
`;

