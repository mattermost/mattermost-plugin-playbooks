// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {StyledComponentBase} from 'styled-components';
import classNames from 'classnames';
import React from 'react';
import {Modal} from 'react-bootstrap';

import {FormattedMessage} from 'react-intl';

import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';

type Props = {
    className?: string;
    onHide: () => void;
    modalHeaderText: React.ReactNode;
    show?: boolean;
    handleCancel?: (() => void) | null;
    handleConfirm?: (() => void) | null;
    confirmButtonText?: React.ReactNode;
    confirmButtonClassName?: string;
    cancelButtonText?: React.ReactNode;
    isConfirmDisabled?: boolean;
    id: string;
    autoCloseOnCancelButton?: boolean;
    autoCloseOnConfirmButton?: boolean;
    enforceFocus?: boolean;
    footer?: React.ReactNode;
    components?: Partial<{
        FooterContainer: typeof DefaultFooterContainer;
    }>;
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
    };

    state = {show: true};

    onHide = () => {
        this.setState({show: false}, () => {
            setTimeout(this.props.onHide, 150);
        });
    }

    handleCancel = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (this.props.autoCloseOnCancelButton) {
            this.onHide();
        }
        this.props.handleCancel?.();
    }

    handleConfirm = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (this.props.autoCloseOnConfirmButton) {
            this.onHide();
        }

        this.props.handleConfirm?.();
    }

    render() {
        let confirmButton;
        if (this.props.handleConfirm) {
            let confirmButtonText: React.ReactNode = <FormattedMessage defaultMessage='Confirm'/>;
            if (this.props.confirmButtonText) {
                confirmButtonText = this.props.confirmButtonText;
            }

            confirmButton = (
                <PrimaryButton
                    type='submit'
                    className={classNames('confirm', this.props.confirmButtonClassName, {
                        disabled: this.props.isConfirmDisabled,
                    })}
                    onClick={this.handleConfirm}
                    disabled={this.props.isConfirmDisabled}
                >
                    {confirmButtonText}
                </PrimaryButton>
            );
        }

        let cancelButton;
        if (this.props.handleCancel) {
            let cancelButtonText: React.ReactNode = <FormattedMessage defaultMessage='Cancel'/>;
            if (this.props.cancelButtonText) {
                cancelButtonText = this.props.cancelButtonText;
            }

            cancelButton = (
                <TertiaryButton
                    type='button'
                    className='cancel'
                    onClick={this.handleCancel}
                >
                    {cancelButtonText}
                </TertiaryButton>
            );
        }

        const FooterContainer = this.props.components?.FooterContainer || DefaultFooterContainer;

        return (
            <StyledModal
                dialogClassName={classNames('a11y__modal GenericModal', this.props.className)}
                show={this.props.show ?? this.state.show}
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
        .modal-body {
            overflow: visible;
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
    gap: 10px;
`;

export const DefaultFooterContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
`;

const ModalHeading = styled.h1`
    font-size: 22px;
    line-height: 28px;
    color: var(--center-channel-color);
`;

export const Description = styled.p`
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    a {
        font-weight: bold;
    }
`;

export const Label = styled.label`
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
    margin-top: 24px;
    margin-bottom: 8px;
`;

export const InlineLabel = styled.label`
    z-index: 1;

    width: max-content;
    margin: 0 0 -8px 12px;
    padding: 0 3px;
    background: var(--center-channel-bg);

    font-weight: normal;
    font-size: 10px;
    line-height: 14px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;
