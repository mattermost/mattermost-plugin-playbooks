// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';

import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {BaseInput} from 'src/components/assets/inputs';

import {VerticalSpacer} from 'src/components/backstage/playbook_runs/shared';

import {RunMetricData} from 'src/types/playbook_run';
import {Metric, MetricType} from 'src/types/playbook';
import {ClockOutline, DollarSign, PoundSign} from '../../playbook_edit/styles';
import {isMetricValueValid, stringToMetric, metricToString} from '../../playbook_edit/metrics/shared';
import {useClickOutsideRef} from 'src/hooks';

interface MetricsProps {
    metricsData: RunMetricData[];
    metricsConfigs: Metric[];
    isPublished: boolean;
    onEdit: (metricsData: RunMetricData[]) => void;
    flushChanges: () => void;
}

const MetricsData = (props: MetricsProps) => {
    const {formatMessage} = useIntl();

    const initialValues = new Array(props.metricsConfigs?.length).fill('');
    props.metricsConfigs.forEach((mc, index) => {
        const md = props.metricsData.find((metric) => {
            return metric.metric_config_id === mc.id;
        });
        if (md) {
            initialValues[index] = metricToString(md.value, mc.type);
        }
    });
    const [inputsValues, setInputsValues] = useState(initialValues);
    const [inputsErrors, setInputsErrors] = useState(new Array(props.metricsConfigs?.length).fill(''));

    const textareaRef = useRef(null);
    useClickOutsideRef(textareaRef, () => {
        props.flushChanges();
    });

    const errorCurrencyInteger = formatMessage({defaultMessage: 'Please enter a number, or leave the target blank.'});
    const errorDuration = formatMessage({defaultMessage: 'Please enter a duration in the format: dd:hh:mm (e.g., 12:00:00), or leave the target blank.'});

    const verifyInputs = (values: string[]): boolean => {
        let isValid = true;
        const newErrors = new Array(props.metricsConfigs?.length).fill('');
        values.forEach((value, index) => {
            if (!isMetricValueValid(props.metricsConfigs[index].type, value)) {
                newErrors[index] = props.metricsConfigs[index].type === MetricType.Duration ? errorDuration : errorCurrencyInteger;
                isValid = false;
            }
        });
        setInputsErrors(newErrors);
        return isValid;
    };

    function stringsToMetricsData(values: string[]) {
        const newMetricsData = new Array<RunMetricData>(props.metricsConfigs?.length);
        props.metricsConfigs.forEach((mc, index) => {
            newMetricsData[index] = {metric_config_id: mc.id, value: stringToMetric(values[index], mc.type)};
        });
        return newMetricsData;
    }

    function updateMetrics(index: number, event: React.ChangeEvent<HTMLInputElement>) {
        const newList = [...inputsValues];
        newList[index] = event.target.value;
        setInputsValues(newList);
        if (verifyInputs(newList)) {
            const newMetricsData = stringsToMetricsData(newList);
            props.onEdit(newMetricsData);
        }
    }

    return (
        <div>
            {
                props.metricsConfigs?.map((metric, idx) => {
                    let inputPlaceholder = formatMessage({defaultMessage: ' Add value'});
                    let inputIcon = <DollarSign sizePx={18}/>;
                    if (metric.type === MetricType.Integer) {
                        inputPlaceholder = formatMessage({defaultMessage: ' Add value'});
                        inputIcon = <PoundSign sizePx={18}/>;
                    } else if (metric.type === MetricType.Duration) {
                        inputPlaceholder = formatMessage({defaultMessage: ' Add value (in dd:hh:mm)'});
                        inputIcon = <ClockOutline sizePx={18}/>;
                    }

                    return (
                        <>
                            <VerticalSpacer size={24}/>
                            <Title>{metric.title}</Title>
                            <InputWithIcon key={metric.id}>
                                {inputIcon}
                                <StyledInput
                                    ref={textareaRef}
                                    placeholder={inputPlaceholder}
                                    type='text'
                                    value={inputsValues[idx]}
                                    onChange={(e) => updateMetrics(idx, e)}
                                    disabled={props.isPublished}
                                />
                            </InputWithIcon>
                            {
                                inputsErrors[idx] !== '' &&
                                <ErrorText>{inputsErrors[idx]}</ErrorText>
                            }
                            <HelpText>{formatMessage({defaultMessage: 'We’ll show you how close or far from the target each run’s value is and also plot it on a chart.'})}</HelpText>
                        </>
                    );
                })
            }
        </div>
    );
};

const HelpText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const ErrorText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: var(--error-text);
`;
const Title = styled.div`
    font-weight: 600;
    margin: 0 0 8px 0;
`;

const InputWithIcon = styled.span`
    position: relative;

    i, svg {
        position: absolute;
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }

    i {
        left: 10px;
        top: 0;
    }

    svg {
        left: 14px;
        top: 2px;
    }

    input {
        padding-left: 36px;
    }
`;

const StyledInput = styled(BaseInput)<{ error?: boolean }>`
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

export default MetricsData;
