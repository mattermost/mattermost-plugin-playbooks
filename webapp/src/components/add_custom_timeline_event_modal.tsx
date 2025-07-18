// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';
import {DateTime} from 'luxon';

import GenericModal from 'src/components/widgets/generic_modal';
import {
    Mode,
    Option,
    ms,
    useDateTimeInput,
} from 'src/components/datetime_input';
import {StyledTextarea} from 'src/components/backstage/styles';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

import {clientAddCustomTimelineEvent} from 'src/client';

interface Props {
    playbookRunId: string;
    show: boolean;
    onHide: () => void;
    onSuccess?: () => void;
}

// Helper function to create default date/time options
const makeDefaultDateTimeOptions = (): Option[] => {
    const now = DateTime.now();

    return [
        {
            label: 'Now',
            value: now,
        },
        {
            label: 'Today at 9 AM',
            value: now.startOf('day').set({hour: 9}),
        },
        {
            label: 'Today at 5 PM',
            value: now.startOf('day').set({hour: 17}),
        },
        {
            label: 'Tomorrow at 9 AM',
            value: now.plus({days: 1}).startOf('day').set({hour: 9}),
        },
        {
            label: 'Yesterday at 5 PM',
            value: now.minus({days: 1}).startOf('day').set({hour: 17}),
        },
        {
            label: 'Last week',
            value: now.minus({days: 7}),
        },
    ];
};

const AddCustomTimelineEventModal = ({playbookRunId, show, onHide, onSuccess}: Props) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const [summary, setSummary] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const defaultOptions = makeDefaultDateTimeOptions();

    const {input: dateTimeInput, value: dateTimeValue} = useDateTimeInput({
        mode: Mode.DateTimeValue,
        defaultOptions,
        placeholder: formatMessage({defaultMessage: 'Type or select date/time (e.g. "tomorrow at 3pm", "yesterday")'}),
    });

    const handleSubmit = async () => {
        if (!summary.trim() || !dateTimeValue?.value || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        try {
            const eventAt = ms(dateTimeValue.value);
            await clientAddCustomTimelineEvent(playbookRunId, summary.trim(), details, eventAt);

            // Reset form
            setSummary('');
            setDetails('');

            onSuccess?.();
            onHide();
        } catch {
            addToast({
                content: formatMessage({defaultMessage: 'Failed to add custom timeline event. Please try again.'}),
                toastStyle: ToastStyle.Failure,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        // Reset form
        setSummary('');
        setDetails('');
        setIsSubmitting(false);
        onHide();
    };

    const isValid = summary.trim().length > 0 && dateTimeValue?.value && details.length <= 1000;

    return (
        <GenericModal
            id={'add-custom-timeline-event-modal'}
            modalHeaderText={formatMessage({defaultMessage: 'Add Custom Event'})}
            show={show}
            onHide={handleCancel}
            confirmButtonText={formatMessage({defaultMessage: 'Add Event'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            isConfirmDisabled={!isValid || isSubmitting}
            handleConfirm={handleSubmit}
            handleCancel={handleCancel}
            showCancel={true}
            autoCloseOnCancelButton={false}
            autoCloseOnConfirmButton={false}
        >
            <FormContainer>
                <FieldContainer>
                    <Label>
                        <FormattedMessage defaultMessage='Summary *'/>
                    </Label>
                    <SummaryInput
                        type='text'
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder={formatMessage({defaultMessage: 'Brief description of the event'})}
                        maxLength={256}
                    />
                </FieldContainer>

                <FieldContainer>
                    <Label>
                        <FormattedMessage defaultMessage='Date and Time *'/>
                    </Label>
                    {dateTimeInput}
                </FieldContainer>

                <FieldContainer>
                    <Label>
                        <FormattedMessage
                            defaultMessage='Details ({characterCount}/1000)'
                            values={{characterCount: details.length}}
                        />
                    </Label>
                    <StyledTextarea
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        placeholder={formatMessage({defaultMessage: 'Additional details about the event (optional)'})}
                        maxLength={1000}
                        rows={4}
                    />
                </FieldContainer>
            </FormContainer>
        </GenericModal>
    );
};

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 8px 0;
`;

const FieldContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const Label = styled.label`
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const SummaryInput = styled.input`
    padding: 10px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    font-size: 14px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);

    &:focus {
        outline: none;
        border-color: var(--button-bg);
        box-shadow: 0 0 0 2px rgba(var(--button-bg-rgb), 0.08);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

export default AddCustomTimelineEventModal;