// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Page, Text, View} from '@react-pdf/renderer';
import {DateTime} from 'luxon';

import {PlaybookRunExportData} from './types';
import {styles} from './styles';

interface CoverPageProps {
    data: PlaybookRunExportData;
}

const CoverPage = ({data}: CoverPageProps) => {
    const {run, team} = data;

    const startDate = DateTime.fromMillis(run.create_at).toFormat('MMM dd, yyyy');
    const endDate = run.end_at ? DateTime.fromMillis(run.end_at).toFormat('MMM dd, yyyy') : 'Ongoing';

    return (
        <Page
            size='A4'
            style={styles.page}
        >
            <View style={styles.coverPage}>
                <Text style={styles.coverTitle}>
                    Run Report
                </Text>
                <Text style={{...styles.coverSubtitle, fontSize: 24, marginBottom: 30}}>
                    {run.name}
                </Text>

                <View style={{marginTop: 40}}>
                    <View style={{...styles.row, marginBottom: 15}}>
                        <Text style={styles.label}>Team:</Text>
                        <Text>{team?.display_name || team?.name || 'Unknown'}</Text>
                    </View>

                    <View style={{...styles.row, marginBottom: 15}}>
                        <Text style={styles.label}>Start Date:</Text>
                        <Text>{startDate}</Text>
                    </View>

                    <View style={{...styles.row, marginBottom: 15}}>
                        <Text style={styles.label}>End Date:</Text>
                        <Text>{endDate}</Text>
                    </View>

                    <View style={{...styles.row, marginBottom: 15}}>
                        <Text style={styles.label}>Status:</Text>
                        <Text>{run.current_status}</Text>
                    </View>
                </View>

                <Text style={{...styles.text, marginTop: 60, color: '#999999', fontSize: 10}}>
                    Generated on {DateTime.now().toFormat('MMM dd, yyyy HH:mm')}
                </Text>
            </View>
        </Page>
    );
};

export default CoverPage;
