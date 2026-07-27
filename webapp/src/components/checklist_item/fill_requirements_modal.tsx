// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {TaskRequirement} from 'src/types/playbook';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import GenericModal from 'src/components/widgets/generic_modal';

type Props = {
    taskTitle: string;
    requirements: TaskRequirement[];
    /** When true, user opened via Edit; when false, via Complete / checkbox. */
    editMode?: boolean;
    /** When true, task is already checked off — hide "mark complete". */
    isTaskComplete?: boolean;
    onSave: (values: Record<string, string>) => void;
    onSaveAndComplete: (values: Record<string, string>) => void;
    onCancel: () => void;
};

const FillRequirementsModal = ({
    taskTitle,
    requirements,
    editMode,
    isTaskComplete,
    onSave,
    onSaveAndComplete,
    onCancel,
}: Props) => {
    const {formatMessage} = useIntl();
    const [values, setValues] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const req of requirements) {
            initial[req.id] = req.value || '';
        }
        return initial;
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const getTrimmedValues = () => {
        const trimmed: Record<string, string> = {};
        for (const req of requirements) {
            trimmed[req.id] = (values[req.id] || '').trim();
        }
        return trimmed;
    };

    const validateAllFilled = (trimmed: Record<string, string>) => {
        const nextErrors: Record<string, string> = {};
        for (const req of requirements) {
            if (!trimmed[req.id]) {
                nextErrors[req.id] = formatMessage({defaultMessage: 'This field is required to mark the task complete'});
            }
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSave = () => {
        setErrors({});
        onSave(getTrimmedValues());
    };

    const handleSaveAndComplete = () => {
        const trimmed = getTrimmedValues();
        if (!validateAllFilled(trimmed)) {
            return;
        }
        onSaveAndComplete(trimmed);
    };

    const showMarkComplete = !isTaskComplete;

    return (
        <GenericModal
            id='playbooks-fill-requirements-modal'
            modalHeaderText={editMode || isTaskComplete ? formatMessage({defaultMessage: 'Edit requirements'}) : formatMessage({defaultMessage: 'Complete requirements'})}
            onHide={onCancel}
            showCancel={false}
            autoCloseOnConfirmButton={false}
            footer={(
                <FooterButtons>
                    <TertiaryButton
                        type='button'
                        data-testid='modal-cancel-button'
                        onClick={onCancel}
                    >
                        {formatMessage({defaultMessage: 'Cancel'})}
                    </TertiaryButton>
                    <TertiaryButton
                        type='button'
                        data-testid='modal-save-requirements'
                        onClick={handleSave}
                    >
                        {formatMessage({defaultMessage: 'Save'})}
                    </TertiaryButton>
                    {showMarkComplete && (
                        <PrimaryButton
                            type='button'
                            data-testid='modal-save-and-complete'
                            onClick={handleSaveAndComplete}
                        >
                            {formatMessage({defaultMessage: 'Save and mark complete'})}
                        </PrimaryButton>
                    )}
                </FooterButtons>
            )}
        >
            <Description>
                {editMode || isTaskComplete ? formatMessage(
                    {defaultMessage: 'Update the required fields for “{taskTitle}”. Save anytime, or fill every field to mark the task complete.'},
                    {taskTitle},
                ) : formatMessage(
                    {defaultMessage: 'Fill in the required fields for “{taskTitle}”. You can save a draft, or mark the task complete when all fields are filled.'},
                    {taskTitle},
                )}
            </Description>
            <Fields>
                {requirements.map((req) => {
                    const hasError = Boolean(errors[req.id]);
                    return (
                        <Field key={req.id}>
                            <Label htmlFor={`requirement-${req.id}`}>
                                {req.label}
                            </Label>
                            <Input
                                id={`requirement-${req.id}`}
                                data-testid={`requirement-value-${req.id}`}
                                type='text'
                                $hasError={hasError}
                                value={values[req.id] || ''}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setValues((prev) => ({...prev, [req.id]: next}));
                                    if (errors[req.id] && next.trim()) {
                                        setErrors((prev) => {
                                            const {[req.id]: _, ...rest} = prev;
                                            return rest;
                                        });
                                    }
                                }}
                            />
                            {hasError && (
                                <ErrorText data-testid={`requirement-error-${req.id}`}>
                                    {errors[req.id]}
                                </ErrorText>
                            )}
                        </Field>
                    );
                })}
            </Fields>
        </GenericModal>
    );
};

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
    margin-bottom: 8px;
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
`;

const Input = styled.input<{$hasError?: boolean}>`
    width: 100%;
    height: 40px;
    box-sizing: border-box;
    padding: 0 16px;
    border: 1px solid ${({$hasError}) => ($hasError ? 'var(--error-text)' : 'rgba(var(--center-channel-color-rgb), 0.16)')};
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 14px;

    &:focus {
        border-color: ${({$hasError}) => ($hasError ? 'var(--error-text)' : 'var(--button-bg)')};
        outline: none;
        box-shadow: 0 0 0 1px ${({$hasError}) => ($hasError ? 'var(--error-text)' : 'var(--button-bg)')};
    }
`;

const ErrorText = styled.div`
    margin-top: 4px;
    color: var(--error-text);
    font-size: 12px;
    line-height: 16px;
`;

const FooterButtons = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
`;

export default FillRequirementsModal;
