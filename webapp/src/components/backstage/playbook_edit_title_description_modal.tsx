// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

import GenericModal, {InlineLabel} from 'src/components/widgets/generic_modal';
import MarkdownTextbox from 'src/components/markdown_textbox';
import {BaseInput} from 'src/components/assets/inputs';

interface Props {
    onChange: (title: string, description: string) => void;
    show: boolean;
    onHide: () => void;
    playbookTitle: string;
    playbookDescription: string;
}

const EditTitleDescriptionModal = (props: Props) => {
    const {formatMessage} = useIntl();

    const [title, setTitle] = useState(props.playbookTitle);
    const [description, setDescription] = useState(props.playbookDescription);

    useEffect(() => {
        setTitle(props.playbookTitle);
        setDescription(props.playbookDescription);
    }, [props.playbookTitle, props.playbookDescription]);

    const handleConfirmNameDescriptionModal = () => {
        props.onChange(title, description);
    };

    const onHide = () => {
        props.onHide();
        setTimeout(() => {
            setDescription(props.playbookDescription);
            setTitle(props.playbookTitle);
        }, 300);
    };

    return (
        <GenericModal
            onHide={onHide}
            modalHeaderText={formatMessage({defaultMessage: 'Edit name and description'})}
            show={props.show}
            handleConfirm={handleConfirmNameDescriptionModal}
            handleCancel={onHide}
            confirmButtonText={formatMessage({defaultMessage: 'Save'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            isConfirmDisabled={title === ''}
            id={'playbook-edit-name-and-description-modal'}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={true}
            enforceFocus={true}
        >
            <EditTitle>
                <InlineLabel>{formatMessage({defaultMessage: 'Playbook name'})}</InlineLabel>
                <EditTitleInput
                    type={'text'}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
            </EditTitle>
            <MarkdownTextbox
                value={description}
                setValue={setDescription}
                placeholder={formatMessage({defaultMessage: '(Optional) Describe how this playbook should be used'})}
                id={'playbook-edit-name-and-description-modal-description-textbox'}
            />
        </GenericModal>
    );
};

const EditTitle = styled.div`
    display: flex;
    flex-direction: column;

    margin-bottom: 24px;
    padding-top: 8px;
`;

const EditTitleInput = styled(BaseInput)`
    margin: 0;

    height: 48px;
    font-size: 16px;
    color: var(--center-channel-color);
`;

export default EditTitleDescriptionModal;
