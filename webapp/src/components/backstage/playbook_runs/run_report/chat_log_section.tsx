// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Text, View} from '@react-pdf/renderer';

import {PlaybookRunExportData} from './types';
import {styles} from './styles';

interface ChatLogSectionProps {
    data: PlaybookRunExportData;
}

const ChatLogSection = ({data}: ChatLogSectionProps) => {
    const {chat_posts} = data;

    if (!chat_posts || chat_posts.length === 0) {
        return null;
    }

    // Group posts by user to find user info
    const getUserInfo = (userId: string) => {
        // Check if it's the owner
        if (data.owner && data.owner.id === userId) {
            return {
                username: data.owner.username,
                firstName: data.owner.first_name,
                lastName: data.owner.last_name,
            };
        }

        // Check participants
        const participant = data.participants.find((p) => p.id === userId);
        if (participant) {
            return {
                username: participant.username,
                firstName: participant.first_name,
                lastName: participant.last_name,
            };
        }

        return {username: 'Unknown User', firstName: '', lastName: ''};
    };

    const formatDisplayName = (userInfo: {username: string; firstName: string; lastName: string}) => {
        if (userInfo.firstName || userInfo.lastName) {
            return `${userInfo.firstName} ${userInfo.lastName}`.trim();
        }
        return userInfo.username;
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Sort posts chronologically (oldest first)
    const sortedPosts = [...chat_posts].sort((a, b) => a.create_at - b.create_at);

    return (
        <View
            style={styles.section}
            break
        >
            <Text style={styles.sectionTitle}>Chat Log</Text>
            <Text style={{...styles.text, marginBottom: 15, color: '#8b8d97'}}>
                Complete conversation history from the run channel
            </Text>

            {sortedPosts.map((post, index) => {
                const userInfo = getUserInfo(post.user_id);
                const displayName = formatDisplayName(userInfo);
                const timestamp = formatTimestamp(post.create_at);

                return (
                    <View
                        key={post.id || index}
                        style={{
                            marginBottom: 12,
                            paddingBottom: 12,
                            borderBottom: index < sortedPosts.length - 1 ? '1px solid #e0e0e0' : 'none',
                        }}
                    >
                        {/* Post Header */}
                        <View style={{...styles.row, marginBottom: 4}}>
                            <Text style={{...styles.label, fontSize: 11, fontWeight: 'bold'}}>
                                {displayName}
                            </Text>
                            <Text style={{...styles.text, fontSize: 9, color: '#8b8d97'}}>
                                {timestamp}
                            </Text>
                        </View>

                        {/* Post Message */}
                        <Text style={{...styles.text, fontSize: 10}}>
                            {post.message || '(No message content)'}
                        </Text>

                        {/* Post Type Indicator */}
                        {post.type && post.type !== '' && (
                            <Text style={{...styles.text, fontSize: 8, color: '#8b8d97', marginTop: 2}}>
                                [{post.type}]
                            </Text>
                        )}
                    </View>
                );
            })}

            <Text style={{...styles.text, marginTop: 15, fontSize: 9, color: '#8b8d97', fontStyle: 'italic'}}>
                Total posts: {sortedPosts.length}
            </Text>
        </View>
    );
};

export default ChatLogSection;
