// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Page, Text, View, StyleSheet} from '@react-pdf/renderer';

import {ReportSections} from './types';
import {styles} from './styles';

interface TableOfContentsProps {
    sections: ReportSections;
}

const tocStyles = StyleSheet.create({
    page: {
        ...styles.page,
        paddingTop: 60,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
        color: '#1c58d9',
        textAlign: 'center',
    },
    tocItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderBottom: '1px solid #e0e0e0',
    },
    tocItemText: {
        fontSize: 12,
        color: '#3f4350',
    },
    tocItemPage: {
        fontSize: 12,
        color: '#8b8d97',
    },
    indent: {
        marginLeft: 20,
    },
});

const TableOfContents = ({sections}: TableOfContentsProps) => {
    // Build the TOC items based on enabled sections
    const tocItems: Array<{title: string; indent?: boolean}> = [];

    if (sections.executiveSummary) {
        tocItems.push({title: 'Executive Summary'});
    }

    if (sections.timeline) {
        tocItems.push({title: 'Timeline'});
    }

    if (sections.statusUpdates) {
        tocItems.push({title: 'Status Updates'});
    }

    if (sections.checklists) {
        tocItems.push({title: 'Checklists'});
    }

    if (sections.retrospective) {
        tocItems.push({title: 'Retrospective'});
        tocItems.push({title: 'Summary', indent: true});
        tocItems.push({title: 'Metrics', indent: true});
    }

    if (sections.chatLog) {
        tocItems.push({title: 'Chat Log'});
    }

    return (
        <Page
            size='A4'
            style={tocStyles.page}
        >
            <Text style={tocStyles.title}>Table of Contents</Text>

            <View style={{marginTop: 20}}>
                {tocItems.map((item, index) => (
                    <View
                        key={index}
                        style={[
                            tocStyles.tocItem,
                            item.indent && tocStyles.indent,
                        ]}
                    >
                        <Text style={tocStyles.tocItemText}>
                            {item.title}
                        </Text>
                        <Text style={tocStyles.tocItemPage}>
                            {/* Page numbers are dynamic, showing placeholder */}
                            {'·'}
                        </Text>
                    </View>
                ))}
            </View>

            <Text
                style={styles.pageNumber}
                render={({pageNumber, totalPages}) => (
                    `${pageNumber} / ${totalPages}`
                )}
                fixed
            />
        </Page>
    );
};

export default TableOfContents;
