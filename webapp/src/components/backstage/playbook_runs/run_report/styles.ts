// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StyleSheet} from '@react-pdf/renderer';

// Shared styles for PDF report components
export const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 40,
        fontSize: 11,
        fontFamily: 'Helvetica',
    },
    coverPage: {
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    coverTitle: {
        fontSize: 32,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    coverSubtitle: {
        fontSize: 16,
        marginBottom: 10,
        color: '#555555',
        textAlign: 'center',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 12,
        color: '#1c58d9',
        borderBottomWidth: 2,
        borderBottomColor: '#1c58d9',
        paddingBottom: 4,
    },
    subsectionTitle: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        marginTop: 10,
        marginBottom: 6,
        color: '#333333',
    },
    text: {
        fontSize: 11,
        marginBottom: 4,
        lineHeight: 1.5,
    },
    label: {
        fontFamily: 'Helvetica-Bold',
        marginRight: 4,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    timestamp: {
        fontSize: 9,
        color: '#666666',
        marginBottom: 2,
    },
    eventItem: {
        marginBottom: 10,
        paddingLeft: 10,
        borderLeftWidth: 2,
        borderLeftColor: '#DDDDDD',
    },
    checklistItem: {
        flexDirection: 'row',
        marginBottom: 4,
        paddingLeft: 15,
    },
    checklistStatus: {
        width: 12,
        marginRight: 6,
        fontSize: 10,
    },
    table: {
        display: 'flex',
        width: 'auto',
        marginBottom: 10,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
        paddingVertical: 6,
    },
    tableHeader: {
        backgroundColor: '#F5F5F5',
        fontFamily: 'Helvetica-Bold',
    },
    tableCol: {
        flex: 1,
        paddingHorizontal: 4,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 9,
        color: '#999999',
    },
    pageNumber: {
        position: 'absolute',
        bottom: 20,
        right: 40,
        fontSize: 9,
        color: '#999999',
    },
});
