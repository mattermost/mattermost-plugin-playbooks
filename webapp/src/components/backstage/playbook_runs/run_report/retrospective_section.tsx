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

    if (!retrospective || (!retrospective.text && (!retrospective.metrics || retrospective.metrics.length === 0))) {
        return null;
    }

    return (
        <View
            style={styles.section}
            break
        >
            <Text style={styles.sectionTitle}>Retrospective</Text>

            {retrospective.text && (
                <View style={{marginBottom: 15}}>
                    <Text style={styles.subsectionTitle}>Summary</Text>
                    <Text style={styles.text}>{retrospective.text}</Text>
                </View>
            )}

            {retrospective.metrics && retrospective.metrics.length > 0 && (
                <View>
                    <Text style={styles.subsectionTitle}>Metrics</Text>
                    {retrospective.metrics.map((metric, index) => (
                        <View
                            key={index}
                            style={{...styles.row, marginBottom: 6}}
                        >
                            <Text style={styles.label}>{metric.metric_config_id}:</Text>
                            <Text style={styles.text}>{metric.value}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

export default RetrospectiveSection;
