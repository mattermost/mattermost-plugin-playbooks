// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Text, View} from '@react-pdf/renderer';
import {DateTime} from 'luxon';

import {PlaybookRunExportData} from './types';
import {styles} from './styles';

interface TimelineSectionProps {
    data: PlaybookRunExportData;
}

const TimelineSection = ({data}: TimelineSectionProps) => {
    const {run} = data;
    const events = run.timeline_events || [];

    if (events.length === 0) {
        return null;
    }

    // Sort events by creation time (newest first)
    const sortedEvents = [...events].sort((a, b) => b.event_at - a.event_at);

    return (
        <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Timeline</Text>

            {sortedEvents.map((event, index) => {
                const eventDate = DateTime.fromMillis(event.event_at).toFormat('MMM dd, yyyy HH:mm');

                return (
                    <View
                        key={event.id || index}
                        style={styles.eventItem}
                    >
                        <Text style={styles.timestamp}>{eventDate}</Text>
                        <Text style={{...styles.text, fontFamily: 'Helvetica-Bold'}}>
                            {event.event_type}
                        </Text>
                        <Text style={styles.text}>{event.summary}</Text>
                        {event.details && (
                            <Text style={{...styles.text, fontSize: 10, color: '#666666'}}>
                                {event.details}
                            </Text>
                        )}
                    </View>
                );
            })}
        </View>
    );
};

export default TimelineSection;
