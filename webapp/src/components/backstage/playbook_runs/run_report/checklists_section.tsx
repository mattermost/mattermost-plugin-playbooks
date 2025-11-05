// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Text, View} from '@react-pdf/renderer';
import {DateTime} from 'luxon';

import {PlaybookRunExportData} from './types';
import {styles} from './styles';
import {MarkdownText} from './markdown_renderer';

interface ChecklistsSectionProps {
    data: PlaybookRunExportData;
}

const ChecklistsSection = ({data}: ChecklistsSectionProps) => {
    const {run} = data;
    const checklists = run.checklists || [];

    if (checklists.length === 0) {
        return null;
    }

    // Helper to get user display name from ID
    const getUserDisplayName = (userId: string): string => {
        if (!userId) {
            return 'Unassigned';
        }

        // Check owner
        if (data.owner && data.owner.id === userId) {
            const name = `${data.owner.first_name} ${data.owner.last_name}`.trim();
            return name || data.owner.username;
        }

        // Check participants
        const participant = data.participants.find((p) => p.id === userId);
        if (participant) {
            const name = `${participant.first_name} ${participant.last_name}`.trim();
            return name || participant.username;
        }

        return userId;
    };

    return (
        <View
            style={styles.section}
            break
        >
            <Text style={styles.sectionTitle}>Checklists & Tasks</Text>

            {checklists.map((checklist, checklistIndex) => {
                const completedItems = checklist.items.filter((item) => item.state === 'closed').length;
                const totalItems = checklist.items.length;
                const completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

                return (
                    <View
                        key={checklist.id || checklistIndex}
                        style={{marginBottom: 20}}
                    >
                        <View style={{...styles.row, marginBottom: 10}}>
                            <Text style={styles.subsectionTitle}>
                                {checklist.title}
                            </Text>
                            <Text style={{...styles.text, fontSize: 10, color: '#8b8d97'}}>
                                {completedItems}/{totalItems} ({completionPercent}%)
                            </Text>
                        </View>

                        {checklist.items.map((item, itemIndex) => {
                            const isCompleted = item.state === 'closed';
                            const statusIcon = isCompleted ? '☑' : '☐';
                            const statusLabel = isCompleted ? 'DONE' : 'TODO';

                            return (
                                <View
                                    key={item.id || itemIndex}
                                    style={{
                                        marginBottom: 12,
                                        paddingLeft: 15,
                                        borderLeft: `3px solid ${isCompleted ? '#3db887' : '#dfe1e6'}`,
                                        paddingBottom: 8,
                                    }}
                                >
                                    {/* Task Header with Status */}
                                    <View style={{...styles.row, marginBottom: 4}}>
                                        <Text style={{
                                            fontSize: 11,
                                            fontWeight: 'bold',
                                            color: isCompleted ? '#3db887' : '#3f4350',
                                        }}>
                                            {statusIcon} {item.title}
                                        </Text>
                                        <Text style={{
                                            fontSize: 8,
                                            color: isCompleted ? '#3db887' : '#ff8800',
                                            backgroundColor: isCompleted ? '#e6f7f1' : '#fff4e6',
                                            padding: '2 6',
                                            borderRadius: 3,
                                        }}>
                                            {statusLabel}
                                        </Text>
                                    </View>

                                    {/* Task Description */}
                                    {item.description && (
                                        <View style={{marginBottom: 6}}>
                                            <MarkdownText
                                                content={item.description}
                                                baseStyle={{
                                                    fontSize: 9,
                                                    color: '#5d5d5d',
                                                    fontStyle: 'italic',
                                                }}
                                            />
                                        </View>
                                    )}

                                    {/* Task Metadata */}
                                    {(item.assignee_id || item.due_date > 0) && (
                                        <View style={{flexDirection: 'row', gap: 15}}>
                                            {item.assignee_id && (
                                                <Text style={{fontSize: 9, color: '#8b8d97'}}>
                                                    👤 Assigned: {getUserDisplayName(item.assignee_id)}
                                                </Text>
                                            )}
                                            {item.due_date > 0 && (
                                                <Text style={{fontSize: 9, color: '#8b8d97'}}>
                                                    📅 Due: {DateTime.fromMillis(item.due_date).toFormat('MMM dd, yyyy')}
                                                </Text>
                                            )}
                                        </View>
                                    )}
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
