// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {VerticalSpacer} from 'src/components/backstage/playbook_runs/shared';

import {RunMetricData} from 'src/types/playbook_run';
import {Metric, MetricType} from 'src/types/playbook';
import {ClockOutline, DollarSign, PoundSign} from '../../../playbook_edit/styles';
import {isMetricValueValid, stringToMetric, metricToString} from '../../../playbook_edit/metrics/shared';

import {useClickOutsideRef} from 'src/hooks';

import MetricInput from './metric_input';

interface MetricsProps {
    metricsData: RunMetricData[];
    metricsConfigs: Metric[];
    isPublished: boolean;
    onEdit: (metricsData: RunMetricData[]) => void;
    flushChanges: () => void;
    setMetricsValid: React.Dispatch<React.SetStateAction<boolean>>
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
        const valid = verifyInputs(newList);
        if (valid) {
            const newMetricsData = stringsToMetricsData(newList);
            props.onEdit(newMetricsData);
        }
        props.setMetricsValid(valid);
    }

    return (
        <div>
            {
                props.metricsConfigs?.map((mc, idx) => {
                    let placeholder = formatMessage({defaultMessage: ' Add value'});
                    let inputIcon = <DollarSign sizePx={18}/>;
                    if (mc.type === MetricType.Integer) {
                        placeholder = formatMessage({defaultMessage: ' Add value'});
                        inputIcon = <PoundSign sizePx={18}/>;
                    } else if (mc.type === MetricType.Duration) {
                        placeholder = formatMessage({defaultMessage: ' Add value (in dd:hh:mm)'});
                        inputIcon = <ClockOutline sizePx={18}/>;
                    }

                    return (
                        <>
                            <VerticalSpacer size={24}/>
                            <MetricInput
                                title={mc.title}
                                value={inputsValues[idx]}
                                placeholder={placeholder}
                                helpText={mc.description}
                                errorText={inputsErrors[idx]}
                                targetValue={metricToString(mc.target, mc.type, true)}
                                inputIcon={inputIcon}
                                inputRef={textareaRef}
                                onChange={(e) => updateMetrics(idx, e)}
                                disabled={props.isPublished}
                            />
                        </>
                    );
                })
            }
        </div>
    );
};

export default MetricsData;
