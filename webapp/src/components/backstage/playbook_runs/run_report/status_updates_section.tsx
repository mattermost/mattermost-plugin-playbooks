// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Text, View} from '@react-pdf/renderer';
import {DateTime} from 'luxon';

import {PlaybookRunExportData} from './types';
import {styles} from './styles';

interface StatusUpdatesSectionProps {
    data: PlaybookRunExportData;
}

const StatusUpdatesSection = ({data}: StatusUpdatesSectionProps) => {
    const {status_updates} = data;

    if (!status_updates || status_updates.length === 0) {
        return null;
    }

    // Sort by creation time (newest first)
    const sortedUpdates = [...status_updates].sort((a, b) => b.create_at - a.create_at);

    return (
        <View
            style={styles.section}
            break
        >
            <Text style={styles.sectionTitle}>Status Updates</Text>

            {sortedUpdates.map((update, index) => {
                const updateDate = DateTime.fromMillis(update.create_at).toFormat('MMM dd, yyyy HH:mm');

                return (
                    <View
                        key={update.id || index}
                        style={{...styles.eventItem, marginBottom: 15}}
                    >
                        <Text style={styles.timestamp}>{updateDate}</Text>
                        <Text style={styles.text}>{update.message}</Text>
                    </View>
                );
            })}
        </View>
    );
};

export default StatusUpdatesSection;
