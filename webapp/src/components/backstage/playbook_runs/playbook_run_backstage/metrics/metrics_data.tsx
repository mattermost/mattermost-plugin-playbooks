// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useImperativeHandle, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {RunMetricData} from 'src/types/playbook_run';
import {Metric, MetricType} from 'src/types/playbook';
import {ClockOutline, DollarSign, PoundSign} from 'src/components/backstage/playbook_edit/styles';
import {isMetricValueValid, stringToMetric, metricToString} from 'src/components/backstage/playbook_edit/metrics/shared';
import {useClickOutsideRef} from 'src/hooks';
import MetricInput from 'src/components/backstage/playbook_runs/playbook_run_backstage/metrics/metric_input';
import {VerticalSpacer} from 'src/components/backstage/styles';

interface MetricsProps {
    metricsData: RunMetricData[];
    metricsConfigs: Metric[];
    notEditable: boolean;
    onEdit: (metricsData: RunMetricData[]) => void;
    flushChanges: () => void;
}

const MetricsData = forwardRef(({metricsData, metricsConfigs, notEditable, onEdit, flushChanges}: MetricsProps, ref) => {
    const {formatMessage} = useIntl();

    const [inputsValues, setInputsValues] = useState(() => {
        const initialValues = new Array(metricsConfigs.length);
        metricsConfigs.forEach((mc, index) => {
            const md = metricsData.find((metric) => metric.metric_config_id === mc.id);
            initialValues[index] = md ? metricToString(md.value, mc.type) : '';
        });
        return initialValues;
    });
    const [inputsErrors, setInputsErrors] = useState(new Array(metricsConfigs.length).fill(''));

    // Handles click outside of metrics inputs to save changes
    const inputRef = useRef(null);
    useClickOutsideRef(inputRef, () => {
        flushChanges();
    });

    //  validateInputs function is called from retrospective component on publish button click, to validate metrics inputs
    useImperativeHandle(
        ref,
        () => ({
            validateInputs() {
                const errors = verifyInputs(inputsValues, true);
                setInputsErrors(errors);

                return !errors.some((e) => e !== '');
            },
        }),
    );

    const errorCurrencyInteger = formatMessage({defaultMessage: 'Please enter a number.'});
    const errorDuration = formatMessage({defaultMessage: 'Please enter a duration in the format: dd:hh:mm (e.g., 12:00:00).'});
    const errorEmptyValue = formatMessage({defaultMessage: 'Please fill in the metric value.'});

    const verifyInputs = (values: string[], forPublishing = false): string[] => {
        const errors = new Array(metricsConfigs.length).fill('');
        values.forEach((value, index) => {
            // If we do before publishing verification, consider empty value as invalid
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
        const newMetricsData = [...metricsData];
        errors.forEach((error, index) => {
            if (error) {
                return;
            }
            const metricNewValue = {metric_config_id: metricsConfigs[index].id, value: stringToMetric(values[index], metricsConfigs[index].type)};
            const existingMetricIdx = newMetricsData.findIndex((m) => m.metric_config_id === metricsConfigs[index].id);

            // Update metric value if exists, otherwise append new element
            if (existingMetricIdx > -1) {
                newMetricsData[existingMetricIdx] = metricNewValue;
            } else {
                newMetricsData.push(metricNewValue);
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
                        inputIcon = <PoundSign sizePx={18}/>;
                    } else if (mc.type === MetricType.Duration) {
                        placeholder = formatMessage({defaultMessage: ' Add value (in dd:hh:mm)'});
                        inputIcon = <ClockOutline sizePx={18}/>;
                    }

                    return (
                        <div key={mc.id}>
                            <VerticalSpacer size={24}/>
                            <MetricInput
                                title={mc.title}
                                value={inputsValues[idx]}
                                placeholder={placeholder}
                                helpText={mc.description}
                                errorText={inputsErrors[idx]}
                                targetValue={metricToString(mc.target, mc.type, true)}
                                mandatory={true}
                                inputIcon={inputIcon}
                                inputRef={inputRef}
                                onChange={(e) => updateMetrics(idx, e)}
                                disabled={notEditable}
                            />
                        </div>
                    );
                })
            }
        </div>
    );
});

export default MetricsData;
