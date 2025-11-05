// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Text, View} from '@react-pdf/renderer';
import {DateTime} from 'luxon';

import {PlaybookRunExportData} from './types';
import {styles} from './styles';

interface ExecutiveSummaryProps {
    data: PlaybookRunExportData;
}

const ExecutiveSummary = ({data}: ExecutiveSummaryProps) => {
    const {run, owner, participants, channel} = data;

    const startDate = DateTime.fromMillis(run.create_at).toFormat('MMM dd, yyyy HH:mm');
    const endDate = run.end_at ? DateTime.fromMillis(run.end_at).toFormat('MMM dd, yyyy HH:mm') : 'Ongoing';

    // Calculate duration
    const duration = run.end_at ?
        DateTime.fromMillis(run.end_at).diff(DateTime.fromMillis(run.create_at), ['days', 'hours', 'minutes']) :
        DateTime.now().diff(DateTime.fromMillis(run.create_at), ['days', 'hours', 'minutes']);

    const durationText = `${Math.floor(duration.days)}d ${Math.floor(duration.hours)}h ${Math.floor(duration.minutes)}m`;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Executive Summary</Text>

            <View style={styles.row}>
                <Text style={styles.label}>Run ID:</Text>
                <Text style={styles.text}>{run.id}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>Status:</Text>
                <Text style={styles.text}>{run.current_status}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>Start Date:</Text>
                <Text style={styles.text}>{startDate}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>End Date:</Text>
                <Text style={styles.text}>{endDate}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>Duration:</Text>
                <Text style={styles.text}>{durationText}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>Owner:</Text>
                <Text style={styles.text}>
                    {owner ? `${owner.username} (${owner.first_name} ${owner.last_name})`.trim() : 'Unknown'}
                </Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>Channel:</Text>
                <Text style={styles.text}>{channel?.display_name || channel?.name || 'Unknown'}</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>Participants:</Text>
                <Text style={styles.text}>{participants.length}</Text>
            </View>

            {run.summary && (
                <View style={{marginTop: 10}}>
                    <Text style={styles.subsectionTitle}>Summary</Text>
                    <Text style={styles.text}>{run.summary}</Text>
                </View>
            )}

            {run.status_posts && run.status_posts.length > 0 && (
                <View style={{marginTop: 10}}>
                    <Text style={styles.subsectionTitle}>Key Statistics</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Status Updates:</Text>
                        <Text style={styles.text}>{run.status_posts.length}</Text>
                    </View>
                </View>
            )}

            {run.timeline_events && run.timeline_events.length > 0 && (
                <View style={styles.row}>
                    <Text style={styles.label}>Timeline Events:</Text>
                    <Text style={styles.text}>{run.timeline_events.length}</Text>
                </View>
            )}

            {run.checklists && run.checklists.length > 0 && (
                <View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Checklists:</Text>
                        <Text style={styles.text}>{run.checklists.length}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Total Tasks:</Text>
                        <Text style={styles.text}>
                            {run.checklists.reduce((acc, checklist) => acc + checklist.items.length, 0)}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
};

export default ExecutiveSummary;
