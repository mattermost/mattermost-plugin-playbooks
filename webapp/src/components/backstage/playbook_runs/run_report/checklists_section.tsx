// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Text, View} from '@react-pdf/renderer';
import {DateTime} from 'luxon';

import {PlaybookRunExportData} from './types';
import {styles} from './styles';

interface ChecklistsSectionProps {
    data: PlaybookRunExportData;
}

const ChecklistsSection = ({data}: ChecklistsSectionProps) => {
    const {run} = data;
    const checklists = run.checklists || [];

    if (checklists.length === 0) {
        return null;
    }

    return (
        <View
            style={styles.section}
            break
        >
            <Text style={styles.sectionTitle}>Checklists & Tasks</Text>

            {checklists.map((checklist, checklistIndex) => {
                const completedItems = checklist.items.filter((item) => item.state === 'closed').length;
                const totalItems = checklist.items.length;

                return (
                    <View
                        key={checklist.id || checklistIndex}
                        style={{marginBottom: 20}}
                    >
                        <Text style={styles.subsectionTitle}>
                            {checklist.title} ({completedItems}/{totalItems} completed)
                        </Text>

                        {checklist.items.map((item, itemIndex) => {
                            const isCompleted = item.state === 'closed';
                            const checkmark = isCompleted ? '\u2713' : '\u2610';

                            let dueDate = '';
                            if (item.due_date > 0) {
                                dueDate = ` - Due: ${DateTime.fromMillis(item.due_date).toFormat('MMM dd, yyyy')}`;
                            }

                            let assignee = '';
                            if (item.assignee_id) {
                                assignee = ` - Assigned to: ${item.assignee_id}`;
                            }

                            return (
                                <View
                                    key={item.id || itemIndex}
                                    style={styles.checklistItem}
                                >
                                    <Text style={styles.checklistStatus}>{checkmark}</Text>
                                    <View style={{flex: 1}}>
                                        <Text style={styles.text}>
                                            {item.title}
                                            {assignee}
                                            {dueDate}
                                        </Text>
                                        {item.description && (
                                            <Text style={{...styles.text, fontSize: 9, color: '#666666', marginTop: 2}}>
                                                {item.description}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                );
            })}
        </View>
    );
};

export default ChecklistsSection;
