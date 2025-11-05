// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Text, View} from '@react-pdf/renderer';

import {PlaybookRunExportData} from './types';
import {styles} from './styles';

interface RetrospectiveSectionProps {
    data: PlaybookRunExportData;
}

const RetrospectiveSection = ({data}: RetrospectiveSectionProps) => {
    const {run} = data;
    const retrospective = run.retrospective;
    const metricsData = run.metrics_data;

    if (!retrospective && (!metricsData || metricsData.length === 0)) {
        return null;
    }

    return (
        <View
            style={styles.section}
            break
        >
            <Text style={styles.sectionTitle}>Retrospective</Text>

            {retrospective && (
                <View style={{marginBottom: 15}}>
                    <Text style={styles.subsectionTitle}>Summary</Text>
                    <Text style={styles.text}>{retrospective}</Text>
                </View>
            )}

            {metricsData && metricsData.length > 0 && (
                <View>
                    <Text style={styles.subsectionTitle}>Metrics</Text>
                    {metricsData.map((metric, index) => (
                        <View
                            key={index}
                            style={{...styles.row, marginBottom: 6}}
                        >
                            <Text style={styles.label}>{metric.metric_config_id}:</Text>
                            <Text style={styles.text}>{metric.value !== null ? String(metric.value) : 'N/A'}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

export default RetrospectiveSection;
