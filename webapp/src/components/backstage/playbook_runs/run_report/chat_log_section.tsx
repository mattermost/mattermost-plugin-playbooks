// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Text, View} from '@react-pdf/renderer';

import {PlaybookRunExportData} from './types';
import {styles} from './styles';
import {MarkdownText} from './markdown_renderer';

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

    // Group posts by threads
    const rootPosts: typeof chat_posts = [];
    const repliesByRootId: Record<string, typeof chat_posts> = {};

    chat_posts.forEach((post) => {
        if (!post.root_id || post.root_id === '') {
            // This is a root post
            rootPosts.push(post);
        } else {
            // This is a reply
            if (!repliesByRootId[post.root_id]) {
                repliesByRootId[post.root_id] = [];
            }
            repliesByRootId[post.root_id].push(post);
        }
    });

    // Sort root posts chronologically (oldest first)
    const sortedRootPosts = rootPosts.sort((a, b) => a.create_at - b.create_at);

    // Sort replies within each thread
    Object.keys(repliesByRootId).forEach((rootId) => {
        repliesByRootId[rootId].sort((a, b) => a.create_at - b.create_at);
    });

    const renderPost = (post: typeof chat_posts[0], isReply: boolean = false, isLastInThread: boolean = false) => {
        const userInfo = getUserInfo(post.user_id);
        const displayName = formatDisplayName(userInfo);
        const timestamp = formatTimestamp(post.create_at);

        return (
            <View
                key={post.id}
                style={{
                    marginBottom: isReply ? 8 : 12,
                    paddingBottom: isReply ? 8 : 12,
                    marginLeft: isReply ? 20 : 0,
                    borderBottom: !isReply && !isLastInThread ? '1px solid #e0e0e0' : 'none',
                    borderLeft: isReply ? '2px solid #1c58d9' : 'none',
                    paddingLeft: isReply ? 10 : 0,
                }}
            >
                {/* Post Header */}
                <View style={{...styles.row, marginBottom: 4}}>
                    <Text style={{...styles.label, fontSize: isReply ? 10 : 11, fontWeight: 'bold'}}>
                        {isReply && '↳ '}{displayName}
                    </Text>
                    <Text style={{...styles.text, fontSize: 9, color: '#8b8d97'}}>
                        {timestamp}
                    </Text>
                </View>

                {/* Post Message */}
                <View>
                    <MarkdownText
                        content={post.message || ''}
                        baseStyle={{...styles.text, fontSize: isReply ? 9 : 10}}
                    />
                </View>

                {/* Post Type Indicator */}
                {post.type && post.type !== '' && (
                    <Text style={{...styles.text, fontSize: 8, color: '#8b8d97', marginTop: 2}}>
                        [{post.type}]
                    </Text>
                )}
            </View>
        );
    };

    return (
        <View
            style={styles.section}
            break
        >
            <Text style={styles.sectionTitle}>Chat Log</Text>
            <Text style={{...styles.text, marginBottom: 15, color: '#8b8d97'}}>
                Conversation history during this run (grouped by threads)
            </Text>

            {sortedRootPosts.map((rootPost, index) => {
                const replies = repliesByRootId[rootPost.id] || [];
                const isLastThread = index === sortedRootPosts.length - 1;
                const hasReplies = replies.length > 0;

                return (
                    <View
                        key={rootPost.id}
                        style={{marginBottom: hasReplies ? 15 : 0}}
                    >
                        {/* Root Post */}
                        {renderPost(rootPost, false, isLastThread && !hasReplies)}

                        {/* Thread Replies */}
                        {replies.map((reply, replyIndex) => {
                            const isLastReply = replyIndex === replies.length - 1;
                            return renderPost(reply, true, isLastThread && isLastReply);
                        })}

                        {/* Thread separator */}
                        {hasReplies && !isLastThread && (
                            <View style={{borderBottom: '1px solid #e0e0e0', marginTop: 10, marginBottom: 10}} />
                        )}
                    </View>
                );
            })}

            <Text style={{...styles.text, marginTop: 15, fontSize: 9, color: '#8b8d97', fontStyle: 'italic'}}>
                Total posts: {chat_posts.length} ({rootPosts.length} threads, {chat_posts.length - rootPosts.length} replies)
            </Text>
        </View>
    );
};

export default ChatLogSection;
