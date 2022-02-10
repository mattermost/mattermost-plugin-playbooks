// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useImperativeHandle, useRef, useState} from 'react';
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
}

const MetricsData = forwardRef(({metricsData, metricsConfigs, isPublished, onEdit, flushChanges}: MetricsProps, ref) => {
    const {formatMessage} = useIntl();

    const initialValues = new Array(metricsConfigs.length);
    metricsConfigs.forEach((mc, index) => {
        const md = metricsData.find((metric) => metric.metric_config_id === mc.id);
        initialValues[index] = md ? metricToString(md.value, mc.type) : '';
    });
    const [inputsValues, setInputsValues] = useState(initialValues);
    const [inputsErrors, setInputsErrors] = useState(new Array(metricsConfigs.length).fill(''));

    const inputRef = useRef(null);
    useClickOutsideRef(inputRef, () => {
        flushChanges();
    });

    useImperativeHandle(
        ref,
        () => ({
            validateInputs() {
                const errors = verifyInputs(inputsValues, true);
                setInputsErrors(errors);

                return !hasErrors(errors);
            },
        }),
    );

    const errorCurrencyInteger = formatMessage({defaultMessage: 'Please enter a number, or leave the target blank.'});
    const errorDuration = formatMessage({defaultMessage: 'Please enter a duration in the format: dd:hh:mm (e.g., 12:00:00), or leave the target blank.'});
    const errorEmptyValue = formatMessage({defaultMessage: 'Please fill in the metric value.'});

    const verifyInputs = (values: string[], forPublishing = false): string[] => {
        const errors = new Array(metricsConfigs.length).fill('');
        values.forEach((value, index) => {
            //If we do before publishing verification, consider empty value as invalid
            if (forPublishing && value === '') {
                errors[index] = errorEmptyValue;
            }
            if (!isMetricValueValid(metricsConfigs[index].type, value)) {
                errors[index] = metricsConfigs[index].type === MetricType.Duration ? errorDuration : errorCurrencyInteger;
            }
        });
        return errors;
    };

    function stringsToMetricsData(values: string[], errors: string[]) {
        const newMetricsData = new Array<RunMetricData>();
        errors.forEach((error, index) => {
            // When input value is invalid, remain existing metric value
            if (error) {
                const metric = metricsData.find((m) => m.metric_config_id === metricsConfigs[index].id);
                if (metric) {
                    newMetricsData.push(metric);
                }
            } else {
                newMetricsData.push({metric_config_id: metricsConfigs[index].id, value: stringToMetric(values[index], metricsConfigs[index].type)});
            }
        });
        return newMetricsData;
    }

    function updateMetrics(index: number, event: React.ChangeEvent<HTMLInputElement>) {
        const newList = [...inputsValues];
        newList[index] = event.target.value;
        const newErrors = verifyInputs(newList);
        setInputsValues(newList);
        setInputsErrors(newErrors);

        const newMetricsData = stringsToMetricsData(newList, newErrors);
        onEdit(newMetricsData);
    }

    return (
        <div>
            {
                metricsConfigs.map((mc, idx) => {
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
                                inputRef={inputRef}
                                onChange={(e) => updateMetrics(idx, e)}
                                disabled={isPublished}
                            />
                        </>
                    );
                })
            }
        </div>
    );
});

function hasErrors(errors: string[]) {
    for (let i = 0; i < errors.length; i++) {
        if (errors[i] !== '') {
            return true;
        }
    }
    return false;
}

export default MetricsData;
