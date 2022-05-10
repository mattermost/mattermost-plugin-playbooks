// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {Scrollbars} from 'react-custom-scrollbars';
import {Modal} from 'react-bootstrap';

import styled from 'styled-components';

import {mdiLightningBoltOutline} from '@mdi/js';
import Icon from '@mdi/react';

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
}

const ActionsModal = (props: Props) => {
    const {formatMessage} = useIntl();

    const header = (
        <Header>
            <ActionsIcon
                path={mdiLightningBoltOutline}
                size={1.6}
            />
            <div>
                {props.title}
                <ModalSubheading>
                    {props.subtitle}
                </ModalSubheading>
            </div>
        </Header>
    );

    return (
        <StyledModal
            id={props.id}
            modalHeaderText={header}
            show={props.show}
            onHide={props.onHide}
            onExited={() => {/* do nothing else after the modal has exited */}}
            handleCancel={props.editable ? props.onHide : null}
            handleConfirm={props.editable ? props.onSave : null}
            confirmButtonText={formatMessage({defaultMessage: 'Save'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            isConfirmDisabled={!props.editable}
            isConfirmDestructive={false}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={false}
            enforceFocus={true}
            adjustTop={400}
            components={{
                Header: ModalHeader,
                FooterContainer: ModalFooter,
            }}
        >
            <Scrollbars
                autoHeight={true}
                autoHeightMax={500}
                renderThumbVertical={renderThumbVertical}
                renderTrackVertical={renderTrackVertical}
            >
                {props.children}
            </Scrollbars>
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

const ActionsIcon = styled(Icon)`
    color: rgba(var(--center-channel-color-rgb), 0.56);
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
