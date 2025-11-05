// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Document, Page, Text, View} from '@react-pdf/renderer';

import {PlaybookRunExportData, ReportSections} from './types';
import {styles} from './styles';
import CoverPage from './cover_page';
import ExecutiveSummary from './executive_summary';
import TimelineSection from './timeline_section';
import StatusUpdatesSection from './status_updates_section';
import ChecklistsSection from './checklists_section';
import RetrospectiveSection from './retrospective_section';

interface ReportDocumentProps {
    data: PlaybookRunExportData;
    sections: ReportSections;
}

const ReportDocument = ({data, sections}: ReportDocumentProps) => {
    return (
        <Document
            title={`${data.run.name} - Run Report`}
            author='Mattermost Playbooks'
            subject='Playbook Run Report'
            creator='Mattermost Playbooks Plugin'
        >
            {/* Cover Page */}
            {sections.coverPage && <CoverPage data={data} />}

            {/* Main Content Pages */}
            <Page
                size='A4'
                style={styles.page}
            >
                {/* Executive Summary */}
                {sections.executiveSummary && <ExecutiveSummary data={data} />}

                {/* Timeline */}
                {sections.timeline && <TimelineSection data={data} />}

                {/* Status Updates */}
                {sections.statusUpdates && <StatusUpdatesSection data={data} />}

                {/* Checklists */}
                {sections.checklists && <ChecklistsSection data={data} />}

                {/* Retrospective */}
                {sections.retrospective && <RetrospectiveSection data={data} />}

                {/* Page Numbers */}
                <Text
                    style={styles.pageNumber}
                    render={({pageNumber, totalPages}) => (
                        `${pageNumber} / ${totalPages}`
                    )}
                    fixed
                />
            </Page>
        </Document>
    );
};

export default ReportDocument;
