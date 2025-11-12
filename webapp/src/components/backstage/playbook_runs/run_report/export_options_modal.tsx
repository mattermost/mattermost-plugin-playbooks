// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {pdf} from '@react-pdf/renderer';

import GenericModal from 'src/components/widgets/generic_modal';
import {ReportSections, PlaybookRunExportData} from './types';
import ReportDocument from './report_document';

interface ExportOptionsModalProps {
    show: boolean;
    onHide: () => void;
    data: PlaybookRunExportData | null;
}

const ExportOptionsModal = ({show, onHide, data}: ExportOptionsModalProps) => {
    const [sections, setSections] = useState<ReportSections>({
        coverPage: true,
        executiveSummary: true,
        timeline: true,
        statusUpdates: true,
        checklists: true,
        retrospective: true,
        chatLog: true,
    });

    const [isGenerating, setIsGenerating] = useState(false);

    const toggleSection = (section: keyof ReportSections) => {
        setSections((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const handleExport = async () => {
        if (!data) {
            return;
        }

        setIsGenerating(true);

        try {
            // Generate PDF
            const doc = <ReportDocument
                data={data}
                sections={sections}
            />;
            const blob = await pdf(doc).toBlob();

            // Download PDF
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${data.run.name}-report-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            onHide();
        } catch (error) {
            console.error('Error generating PDF:', error);
            // TODO: Show error message to user
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <GenericModal
            show={show}
            onHide={onHide}
            modalHeading='Export Run Report'
            confirmButtonText={isGenerating ? 'Generating...' : 'Generate Report'}
            cancelButtonText='Cancel'
            handleCancel={onHide}
            handleConfirm={handleExport}
            isConfirmDisabled={isGenerating}
            showCancel={!isGenerating}
            id='export-run-report-modal'
        >
            <Container>
                <Description>
                    Select the sections you want to include in the PDF report:
                </Description>

                <SectionList>
                    <SectionItem>
                        <Checkbox
                            type='checkbox'
                            checked={sections.coverPage}
                            onChange={() => toggleSection('coverPage')}
                            disabled={isGenerating}
                        />
                        <Label>Cover Page</Label>
                    </SectionItem>

                    <SectionItem>
                        <Checkbox
                            type='checkbox'
                            checked={sections.executiveSummary}
                            onChange={() => toggleSection('executiveSummary')}
                            disabled={isGenerating}
                        />
                        <Label>Executive Summary</Label>
                    </SectionItem>

                    <SectionItem>
                        <Checkbox
                            type='checkbox'
                            checked={sections.timeline}
                            onChange={() => toggleSection('timeline')}
                            disabled={isGenerating}
                        />
                        <Label>Timeline</Label>
                    </SectionItem>

                    <SectionItem>
                        <Checkbox
                            type='checkbox'
                            checked={sections.statusUpdates}
                            onChange={() => toggleSection('statusUpdates')}
                            disabled={isGenerating}
                        />
                        <Label>Status Updates</Label>
                    </SectionItem>

                    <SectionItem>
                        <Checkbox
                            type='checkbox'
                            checked={sections.checklists}
                            onChange={() => toggleSection('checklists')}
                            disabled={isGenerating}
                        />
                        <Label>Checklists & Tasks</Label>
                    </SectionItem>

                    <SectionItem>
                        <Checkbox
                            type='checkbox'
                            checked={sections.retrospective}
                            onChange={() => toggleSection('retrospective')}
                            disabled={isGenerating}
                        />
                        <Label>Retrospective</Label>
                    </SectionItem>

                    <SectionItem>
                        <Checkbox
                            type='checkbox'
                            checked={sections.chatLog}
                            onChange={() => toggleSection('chatLog')}
                            disabled={isGenerating}
                        />
                        <Label>Complete Chat Log</Label>
                    </SectionItem>
                </SectionList>

                {isGenerating && (
                    <GeneratingMessage>
                        Generating PDF... This may take a moment.
                    </GeneratingMessage>
                )}
            </Container>
        </GenericModal>
    );
};

const Container = styled.div`
    padding: 16px 0;
`;

const Description = styled.p`
    margin-bottom: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
`;

const SectionList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const SectionItem = styled.div`
    display: flex;
    align-items: center;
`;

const Checkbox = styled.input`
    margin-right: 8px;
    cursor: pointer;
    width: 16px;
    height: 16px;
`;

const Label = styled.label`
    font-size: 14px;
    cursor: pointer;
    user-select: none;
`;

const GeneratingMessage = styled.div`
    margin-top: 16px;
    padding: 12px;
    background-color: rgba(var(--button-bg-rgb), 0.08);
    border-radius: 4px;
    text-align: center;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
`;

export default ExportOptionsModal;
