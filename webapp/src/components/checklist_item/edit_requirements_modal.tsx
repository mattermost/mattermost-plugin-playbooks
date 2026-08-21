// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {generateId} from 'mattermost-redux/utils/helpers';

import {TaskRequirement} from 'src/types/playbook';
import GenericModal from 'src/components/widgets/generic_modal';

export const MAX_REQUIREMENT_LABEL_LENGTH = 128;
export const MAX_REQUIREMENTS_PER_ITEM = 20;

type DraftRequirement = {
    id: string;
    label: string;
    isNew?: boolean;
};

type Props = {
    initialRequirements?: TaskRequirement[];
    onConfirm: (requirements: TaskRequirement[]) => void;
    onCancel: () => void;
};

const EditRequirementsModal = ({initialRequirements = [], onConfirm, onCancel}: Props) => {
    const {formatMessage} = useIntl();
    const isEditing = initialRequirements.length > 0;

    const [drafts, setDrafts] = useState<DraftRequirement[]>(() => {
        if (initialRequirements.length === 0) {
            return [{id: generateId(), label: '', isNew: true}];
        }
        return initialRequirements.map((r) => ({id: r.id, label: r.label}));
    });

    const trimmed = drafts
        .map((d) => ({...d, label: d.label.trim()}))
        .filter((d) => d.label !== '');

    // When adding for the first time, require at least one. When editing, allow clearing all.
    const canSave = isEditing || trimmed.length > 0;
    const canAddAnother = drafts.length < MAX_REQUIREMENTS_PER_ITEM;

    const updateLabel = (id: string, value: string) => {
        setDrafts((prev) => prev.map((d) => (d.id === id ? {...d, label: value.slice(0, MAX_REQUIREMENT_LABEL_LENGTH)} : d)));
    };

    const addField = () => {
        if (!canAddAnother) {
            return;
        }
        setDrafts((prev) => [...prev, {id: generateId(), label: '', isNew: true}]);
    };

    const removeField = (id: string) => {
        setDrafts((prev) => {
            const next = prev.filter((d) => d.id !== id);
            return next.length === 0 ? [{id: generateId(), label: '', isNew: true}] : next;
        });
    };

    const handleSave = () => {
        const valueById = new Map(initialRequirements.map((r) => [r.id, r.value || '']));
        onConfirm(trimmed.map((d) => ({
            id: d.id,
            label: d.label,
            value: valueById.get(d.id) || '',
        })));
    };

    return (
        <StyledModal
            id='playbooks-edit-requirements-modal'
            modalHeaderText={isEditing ? formatMessage({defaultMessage: 'Edit requirements'}) : formatMessage({defaultMessage: 'Add requirements'})}
            confirmButtonText={isEditing ? formatMessage({defaultMessage: 'Save'}) : formatMessage({defaultMessage: 'Add'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            handleConfirm={handleSave}
            handleCancel={onCancel}
            onHide={onCancel}
            isConfirmDisabled={!canSave}
            showCancel={true}
            autoCloseOnConfirmButton={true}
        >
            <Description>
                {formatMessage({defaultMessage: 'Anyone checking off this task will be asked to fill in these fields. Add, edit, or remove text inputs.'})}
            </Description>
            <Fields>
                {drafts.map((draft, index) => (
                    <Field key={draft.id}>
                        <Label htmlFor={`requirement-label-input-${draft.id}`}>
                            {formatMessage(
                                {defaultMessage: 'Requirement {number}'},
                                {number: index + 1},
                            )}
                        </Label>
                        <FieldRow>
                            <Input
                                id={`requirement-label-input-${draft.id}`}
                                data-testid={index === 0 ? 'requirement-label-input' : `requirement-label-input-${index}`}
                                type='text'
                                autoFocus={index === 0}
                                maxLength={MAX_REQUIREMENT_LABEL_LENGTH}
                                value={draft.label}
                                placeholder={formatMessage({defaultMessage: 'e.g. Ticket URL, Root cause'})}
                                onChange={(e) => updateLabel(draft.id, e.target.value)}
                            />
                            {(drafts.length > 1 || (isEditing && draft.label.trim() !== '')) && (
                                <RemoveButton
                                    type='button'
                                    title={formatMessage({defaultMessage: 'Remove'})}
                                    onClick={() => removeField(draft.id)}
                                    data-testid={`remove-requirement-draft-${draft.id}`}
                                >
                                    <i className='icon icon-close'/>
                                </RemoveButton>
                            )}
                        </FieldRow>
                    </Field>
                ))}
            </Fields>
            {canAddAnother && (
                <AddAnother
                    type='button'
                    onClick={addField}
                    data-testid='add-another-requirement'
                >
                    <i className='icon icon-plus'/>
                    {formatMessage({defaultMessage: 'Add another requirement'})}
                </AddAnother>
            )}
        </StyledModal>
    );
};

const StyledModal = styled(GenericModal)`
    .modal-content {
        max-height: calc(100vh - 32px);
    }

    .modal-body {
        overflow-y: auto;
        min-height: 0;
        max-height: calc(100vh - 180px);
    }
`;

const Description = styled.p`
    margin: 0 0 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
`;

const Fields = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
`;

const Label = styled.label`
    display: block;
    margin-bottom: 8px;
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
`;

const FieldRow = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const Input = styled.input`
    width: 100%;
    height: 40px;
    box-sizing: border-box;
    padding: 0 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 14px;

    &:focus {
        border-color: var(--button-bg);
        outline: none;
        box-shadow: 0 0 0 1px var(--button-bg);
    }
`;

const RemoveButton = styled.button`
    display: flex;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--error-text);
    }
`;

const AddAnother = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 16px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--button-bg);
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;

    &:hover {
        text-decoration: underline;
    }

    i {
        font-size: 16px;
    }
`;

export default EditRequirementsModal;
