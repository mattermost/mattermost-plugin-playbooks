// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';

import GenericModal from 'src/components/widgets/generic_modal';

export type Surface = 'run' | 'playbook';

export type ExportFormat = 'md' | 'html' | 'pdf';

export type TranscriptMode = 'threaded' | 'chronological';

export type SectionFlags = {
    cover?: boolean;
    executiveSummary?: boolean;
    timeline?: boolean;
    statusUpdates?: boolean;
    checklists?: boolean;
    retrospective?: boolean;
    transcript?: boolean;
    playbookOverview?: boolean;
    playbookChecklistTemplates?: boolean;
    playbookSettings?: boolean;
};

export type ExportOptionsModalProps = {
    surface: Surface;
    defaults: SectionFlags;
    onConfirm: (sections: SectionFlags, format: ExportFormat, transcriptMode: TranscriptMode) => void;
    onCancel: () => void;
    channelExportAvailable?: boolean;
    pdfAvailableServerSide?: boolean; // true when PdfRendererBackend is configured
};

type ToggleRow = {
    key: keyof SectionFlags;
    label: React.ReactNode;
};

const RUN_DEFAULTS: SectionFlags = {
    cover: true,
    executiveSummary: true,
    timeline: true,
    statusUpdates: true,
    checklists: true,
    retrospective: true,
    transcript: false,
};

const PLAYBOOK_DEFAULTS: SectionFlags = {
    playbookOverview: true,
    playbookChecklistTemplates: true,
    playbookSettings: true,
};

export const DEFAULT_SECTIONS = {
    run: RUN_DEFAULTS,
    playbook: PLAYBOOK_DEFAULTS,
};

const ExportOptionsModal = ({surface, defaults, onConfirm, onCancel, channelExportAvailable = false, pdfAvailableServerSide = false}: ExportOptionsModalProps) => {
    const {formatMessage} = useIntl();
    const baseDefaults = surface === 'run' ? RUN_DEFAULTS : PLAYBOOK_DEFAULTS;
    const [sections, setSections] = useState<SectionFlags>({...baseDefaults, ...defaults});
    const [format, setFormat] = useState<ExportFormat>('pdf');
    const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>('threaded');

    const rows: ToggleRow[] = surface === 'run' ? [
        {key: 'cover', label: formatMessage({defaultMessage: 'Cover page'})},
        {key: 'executiveSummary', label: formatMessage({defaultMessage: 'Executive summary'})},
        {key: 'timeline', label: formatMessage({defaultMessage: 'Timeline'})},
        {key: 'statusUpdates', label: formatMessage({defaultMessage: 'Status updates'})},
        {key: 'checklists', label: formatMessage({defaultMessage: 'Tasks'})},
        {key: 'retrospective', label: formatMessage({defaultMessage: 'Retrospective'})},
        {key: 'transcript', label: formatMessage({defaultMessage: 'Channel transcript'})},
    ] : [
        {key: 'playbookOverview', label: formatMessage({defaultMessage: 'Overview'})},
        {key: 'playbookChecklistTemplates', label: formatMessage({defaultMessage: 'Tasks'})},
        {key: 'playbookSettings', label: formatMessage({defaultMessage: 'Settings & automations'})},
    ];

    const toggle = (key: keyof SectionFlags) => {
        setSections((prev) => ({...prev, [key]: !prev[key]}));
    };

    const anySelected = rows.some((r) => sections[r.key]);

    const headerText = surface === 'run' ?
        formatMessage({defaultMessage: 'Export run report'}) :
        formatMessage({defaultMessage: 'Export playbook'});

    return (
        <GenericModal
            id='export-options-modal'
            modalHeaderText={headerText}
            show={true}
            onHide={onCancel}
            handleCancel={onCancel}
            handleConfirm={() => onConfirm(sections, format, transcriptMode)}
            confirmButtonText={<FormattedMessage defaultMessage='Download'/>}
            cancelButtonText={<FormattedMessage defaultMessage='Cancel'/>}
            isConfirmDisabled={!anySelected}
            showCancel={true}
        >
            <Body>
                <FormatSelector>
                    <FormatButton
                        data-testid='format-button-md'
                        selected={format === 'md'}
                        onClick={() => setFormat('md')}
                    >
                        <i className='icon icon-file-text-outline'/>
                        <FormattedMessage defaultMessage='Markdown'/>
                    </FormatButton>
                    <FormatButton
                        data-testid='format-button-html'
                        selected={format === 'html'}
                        onClick={() => setFormat('html')}
                    >
                        <i className='icon icon-code-tags'/>
                        <FormattedMessage defaultMessage='HTML'/>
                    </FormatButton>
                    <FormatButton
                        data-testid='format-button-pdf'
                        selected={format === 'pdf'}
                        onClick={() => setFormat('pdf')}
                    >
                        <i className='icon icon-file-pdf-outline'/>
                        <FormattedMessage defaultMessage='PDF'/>
                    </FormatButton>
                </FormatSelector>
                {format === 'pdf' && !pdfAvailableServerSide && (
                    <FormatHint data-testid='format-hint'>
                        <FormattedMessage defaultMessage='Rendered in your browser — Save as PDF in the print dialog'/>
                    </FormatHint>
                )}
                {format === 'pdf' && pdfAvailableServerSide && (
                    <FormatHint data-testid='format-hint'>
                        <FormattedMessage defaultMessage='Server-rendered via Gotenberg'/>
                    </FormatHint>
                )}
                <Description>
                    <FormattedMessage defaultMessage='Select the sections to include in the export.'/>
                </Description>
                <Toggles>
                    {rows.map((row) => (
                        <ToggleLabel
                            key={row.key}
                            data-testid={`section-toggle-${row.key}`}
                        >
                            <input
                                type='checkbox'
                                checked={Boolean(sections[row.key])}
                                onChange={() => toggle(row.key)}
                            />
                            <span>{row.label}</span>
                        </ToggleLabel>
                    ))}
                </Toggles>
                {surface === 'run' && sections.transcript && (
                    <TranscriptModeBox data-testid='transcript-mode-box'>
                        <TranscriptModeLabel>
                            <FormattedMessage defaultMessage='Transcript layout'/>
                        </TranscriptModeLabel>
                        <TranscriptModeRadio data-testid='transcript-mode-threaded'>
                            <input
                                type='radio'
                                name='transcript-mode'
                                value='threaded'
                                checked={transcriptMode === 'threaded'}
                                onChange={() => setTranscriptMode('threaded')}
                            />
                            <div>
                                <strong><FormattedMessage defaultMessage='Grouped by thread'/></strong>
                                <small>
                                    <FormattedMessage defaultMessage='Roots are top-level; replies appear directly under their root (Mattermost UI default).'/>
                                </small>
                            </div>
                        </TranscriptModeRadio>
                        <TranscriptModeRadio data-testid='transcript-mode-chronological'>
                            <input
                                type='radio'
                                name='transcript-mode'
                                value='chronological'
                                checked={transcriptMode === 'chronological'}
                                onChange={() => setTranscriptMode('chronological')}
                            />
                            <div>
                                <strong><FormattedMessage defaultMessage='Fully chronological'/></strong>
                                <small>
                                    <FormattedMessage defaultMessage='Posts emit in strict timestamp order; replies carry a ↳ indicator.'/>
                                </small>
                            </div>
                        </TranscriptModeRadio>
                    </TranscriptModeBox>
                )}
                {surface === 'run' && channelExportAvailable && (
                    <ChannelExportHint data-testid='channel-export-hint'>
                        <FormattedMessage defaultMessage="Need a CSV transcript? Use channel-export's /export slash command in this run's channel."/>
                    </ChannelExportHint>
                )}
            </Body>
        </GenericModal>
    );
};

export default ExportOptionsModal;

const Body = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 0 16px;
`;

const Description = styled.p`
    margin: 0;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
`;

const Toggles = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const ToggleLabel = styled.label`
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    cursor: pointer;

    input[type='checkbox'] {
        margin: 0;
        cursor: pointer;
    }
`;

const ChannelExportHint = styled.div`
    padding: 10px 12px;
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    line-height: 16px;
`;

const FormatSelector = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
`;

const FormatButton = styled.button<{selected: boolean}>`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1.5px solid ${({selected}) => selected ? 'var(--button-bg, #1c58d9)' : 'rgba(var(--center-channel-color-rgb, 63, 67, 80), 0.16)'};
    background: ${({selected}) => selected ? 'rgba(var(--button-bg-rgb, 28, 88, 217), 0.08)' : 'transparent'};
    color: ${({selected}) => selected ? 'var(--button-bg, #1c58d9)' : 'var(--center-channel-color, #3f4350)'};
    font-size: 14px;
    font-weight: ${({selected}) => selected ? 600 : 400};
    cursor: pointer;
    transition: all 0.1s;
    &:hover { background: rgba(var(--button-bg-rgb, 28, 88, 217), 0.08); }
`;

const FormatHint = styled.p`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb, 63, 67, 80), 0.64);
    margin: -8px 0 12px;
    text-align: center;
`;

const TranscriptModeBox = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    background: rgba(var(--center-channel-color-rgb), 0.03);
`;

const TranscriptModeLabel = styled.div`
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin-bottom: 2px;
`;

const TranscriptModeRadio = styled.label`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0;
    cursor: pointer;

    input[type='radio'] {
        margin: 3px 0 0;
        flex-shrink: 0;
        cursor: pointer;
    }

    div {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    strong {
        font-size: 13px;
        font-weight: 600;
        color: var(--center-channel-color);
    }

    small {
        font-size: 12px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        line-height: 1.3;
    }
`;
