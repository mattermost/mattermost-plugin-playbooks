// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Duration} from 'luxon';
import styled from 'styled-components';

import {MetricType} from 'src/types/playbook';
import {formatDuration} from 'src/components/formatted_duration';

export const metricToString = (target: number, type: MetricType, naturalDuration = false) => {
    if (!target) {
        if (type === MetricType.Integer || type === MetricType.Currency) {
            return '0';
        }
        return naturalDuration ? formatDuration(Duration.fromMillis(0), 'long') : '00:00:00';
    }

    if (type === MetricType.Integer || type === MetricType.Currency) {
        return target.toString();
    }

    if (naturalDuration) {
        return formatDuration(Duration.fromMillis(target), 'long');
    }

    const dur = Duration.fromMillis(target).shiftTo('days', 'hours', 'minutes');
    const dd = dur.days.toString().padStart(2, '0');
    const hh = dur.hours.toString().padStart(2, '0');
    const mm = dur.minutes.toString().padStart(2, '0');
    return `${dd}:${hh}:${mm}`;
};

export const stringToMetric = (target: string, type: MetricType) => {
    if (target === '') {
        return 0;
    }

    if (type === MetricType.Integer || type === MetricType.Currency) {
        return parseInt(target, 10);
    }

    // assuming we've verified this is a duration in the format dd:mm:ss
    const ddmmss = target.split(':').map((c) => parseInt(c, 10));
    return Duration.fromObject({
        days: ddmmss[0],
        hours: ddmmss[1],
        minutes: ddmmss[2],
    }).as('milliseconds');
};

export const isMetricValueValid = (type: MetricType, value: string) => {
    if (type === MetricType.Duration) {
        const regex = /(^$|^\d{1,2}:\d{1,2}:\d{1,2}$)/;
        if (!regex.test(value)) {
            return false;
        }
    } else {
        const regex = /^\d*$/;
        if (!regex.test(value)) {
            return false;
        }
    }
    return true;
};