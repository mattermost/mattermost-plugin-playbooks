// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {Metric, MetricType} from 'src/types/playbook';
import {BaseInput, BaseTextArea} from 'src/components/assets/inputs';
import {PrimaryButton} from 'src/components/assets/buttons';
import {VerticalSpacer} from 'src/components/backstage/playbook_runs/shared';
import {ClockOutline, DollarSign, PoundSign} from 'src/components/backstage/playbook_edit/styles';
import {stringToTarget, targetToString} from 'src/components/backstage/playbook_edit/metrics/shared';

type SetState = (prevState: Metric) => Metric;

interface Props {
    metric: Metric;
    setMetric: (setState: SetState) => void;
    otherTitles: string[];
    onAdd: (target: number) => void;
    saveToggle: boolean;
    saveFailed: () => void;
}

const MetricEdit = ({metric, setMetric, otherTitles, onAdd, saveToggle, saveFailed}: Props) => {
    const {formatMessage} = useIntl();
    const [curTargetString, setCurTargetString] = useState(() => targetToString(metric.target, metric.type));
    const [curSaveToggle, setCurSaveToggle] = useState(saveToggle);
    const [titleError, setTitleError] = useState('');
    const [targetError, setTargetError] = useState('');

    const errorTitleDuplicate = formatMessage({defaultMessage: 'A metric with the same name already exists. Please add a unique name for each metric.'});
    const errorTitleMissing = formatMessage({defaultMessage: 'Please add a title for your metric.'});
    const errorTargetCurrencyInteger = formatMessage({defaultMessage: 'Please enter a number, or leave the target blank.'});
    const errorTargetDuration = formatMessage({defaultMessage: 'Please enter a duration in the format: dd:hh:mm (e.g., 12:00:00), or leave the target blank.'});

    const verifyAndSave = (): boolean => {
        // Is the title unique?
        if (otherTitles.includes(metric.title)) {
            setTitleError(errorTitleDuplicate);
            return false;
        }

        // Is the title set?
        if (metric.title === '') {
            setTitleError(errorTitleMissing);
            return false;
        }

        // Is the target valid?
        if (metric.type === MetricType.Duration) {
            const regex = /(^$|^\d{1,2}:\d{1,2}:\d{1,2}$)/;
            if (!regex.test(curTargetString)) {
                setTargetError(errorTargetDuration);
                return false;
            }
        } else {
            const regex = /^\d*$/;
            if (!regex.test(curTargetString)) {
                setTargetError(errorTargetCurrencyInteger);
                return false;
            }
        }

        // target is valid. Convert it and save the metric.
        const target = stringToTarget(curTargetString, metric.type);
        onAdd(target);
        return true;
    };

    if (saveToggle !== curSaveToggle) {
        // we've been asked to save, either internally or externally, so verify and save if possible.
        setCurSaveToggle(saveToggle);
        const success = verifyAndSave();
        if (!success) {
            saveFailed();
        }
    }

    let typeTitle = <Bold><DollarSign sizePx={18}/>{' Dollars'}</Bold>;
    let inputIcon = <DollarSign sizePx={18}/>;
    if (metric.type === MetricType.Integer) {
        typeTitle = <Bold><PoundSign sizePx={18}/>{' Integer'}</Bold>;
        inputIcon = <PoundSign sizePx={18}/>;
    } else if (metric.type === MetricType.Duration) {
        typeTitle = <Bold><ClockOutline sizePx={18}/>{' Duration (in dd:hh:mm)'}</Bold>;
        inputIcon = <ClockOutline sizePx={18}/>;
    }

    return (
        <>
            <EditHeader>
                {'Type: '}
                {typeTitle}
            </EditHeader>
            <EditContainer>
                <Title>{'Title'}</Title>
                <StyledInput
                    error={titleError !== ''}
                    placeholder={formatMessage({defaultMessage: 'Name of the metric'})}
                    type='text'
                    value={metric.title}
                    onChange={(e) => {
                        const title = e.target.value;
                        setMetric((prevState) => ({...prevState, title}));
                        setTitleError('');
                    }}
                    autoFocus={true}
                    maxLength={64}
                />
                <Error text={titleError}/>
                <VerticalSpacer size={16}/>
                <Title>{'Target per run'}</Title>
                <InputWithIcon>
                    {inputIcon}
                    <StyledInput
                        error={targetError !== ''}
                        placeholder={formatMessage({defaultMessage: 'Target value for each run'})}
                        type='text'
                        value={curTargetString}
                        onChange={(e) => {
                            setCurTargetString(e.target.value.trim());
                            setTargetError('');
                        }}
                    />
                </InputWithIcon>
                <Error text={targetError}/>
                <HelpText>{formatMessage({defaultMessage: 'We’ll show you how close or far from the target each run’s value is and also plot it on a chart.'})}</HelpText>
                <VerticalSpacer size={16}/>
                <Title>{'Description'}</Title>
                <StyledTextarea
                    placeholder={formatMessage({defaultMessage: 'Describe what this metric is about'})}
                    rows={2}
                    value={metric.description}
                    onChange={(e) => {
                        const description = e.target.value;
                        setMetric((prevState) => ({...prevState, description}));
                    }}
                />
                <HelpText>{formatMessage({defaultMessage: 'Add details on what this metric is about and how it should be filled in. This description will be available on the retrospective page for each run where values for these metrics will be input.'})}</HelpText>
                <VerticalSpacer size={16}/>
                <PrimaryButton onClick={verifyAndSave}>{'Add'}</PrimaryButton>
            </EditContainer>
        </>
    );
};

const EditHeader = styled.div`
    font-size: 14px;
    line-height: 20px;
    padding: 12px 24px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px 4px 0 0;
`;

const EditContainer = styled.div`
    font-size: 14px;
    line-height: 20px;
    padding: 16px 24px 24px;
    margin-bottom: 12px;
    color: var(--center-channel-color);
    background: var(--center-channel-bg);
    border-radius: 0 0 4px 4px;
`;

const Bold = styled.span`
    font-weight: 600;

    > svg {
        position: relative;
        top: 3px;
    }
`;

const Title = styled.div`
    font-weight: 600;
    margin: 0 0 8px 0;
`;

const HelpText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const Error = ({text}: { text: string }) => (
    text === '' ? null : <ErrorText>{text}</ErrorText>
);

const ErrorText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: var(--error-text);
`;

const StyledInput = styled(BaseInput)<{ error?: boolean }>`
    height: 40px;
    width: 100%;

    ${(props) => (
        props.error && css`
            box-shadow: inset 0 0 0 1px var(--error-text);

            &:focus {
                box-shadow: inset 0 0 0 2px var(--error-text);
            }
        `
    )}
`;

const InputWithIcon = styled.span`
    position: relative;

    svg {
        position: absolute;
        left: 14px;
        top: 1px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }

    input {
        padding-left: 36px;
    }
`;

const StyledTextarea = styled(BaseTextArea)`
    width: 100%;
    margin-bottom: -4px;
`;

export default MetricEdit;
