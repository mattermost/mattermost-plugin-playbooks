// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {ClockOutlineIcon} from '@mattermost/compass-icons/components';

import type {
    ReportFormat,
    ReportSections,
    RunReportOptions,
    TranscriptMode,
} from 'src/client';
import GenericModal from 'src/components/widgets/generic_modal';
import {StyledSelect} from 'src/components/backstage/styles';

export type ExportOptionsModalProps = {

    // onConfirm runs the export. The modal stays open, showing "Exporting…", until the
    // returned promise settles; the caller closes it.
    onConfirm: (sections: ReportSections, format: ReportFormat, runOptions: RunReportOptions) => Promise<void>;
    onCancel: () => void;
    channelExportAvailable?: boolean;
};

type ToggleRow = {
    key: keyof ReportSections;
    label: React.ReactNode;

    // A locked section is always part of the report.
    locked?: boolean;
};

type TimeZoneOption = {value: string; label: string};

const DEFAULT_SECTIONS: ReportSections = {
    executiveSummary: true,
    timeline: true,
    statusUpdates: true,
    checklists: true,
    retrospective: true,
    transcript: true,
};

const ExportOptionsModal = ({onConfirm, onCancel, channelExportAvailable = false}: ExportOptionsModalProps) => {
    const {formatMessage} = useIntl();
    const [sections, setSections] = useState<ReportSections>(DEFAULT_SECTIONS);
    const [format, setFormat] = useState<ReportFormat>('pdf');
    const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>('threaded');

    // An empty time zone means the user's own, which the server uses by default.
    const [timeZone, setTimeZone] = useState('');
    const [exporting, setExporting] = useState(false);

    const userTimeZone = useSelector(getCurrentTimezone);
    const timeZoneOptions = useMemo<TimeZoneOption[]>(() => [
        {value: '', label: formatMessage({defaultMessage: '{timeZone} (your time zone)'}, {timeZone: timeZoneLabel(userTimeZone)})},
        ...Intl.supportedValuesOf('timeZone').map((tz) => ({value: tz, label: timeZoneLabel(tz)})),
    ], [userTimeZone, formatMessage]);

    // A running export closes the dialog when it finishes, so the dialog
    // stays until then; otherwise it could close one opened in the meantime.
    const cancel = () => {
        if (!exporting) {
            onCancel();
        }
    };

    const confirm = async () => {
        setExporting(true);
        try {
            await onConfirm(sections, format, {transcriptMode, timeZone});
        } finally {
            setExporting(false);
        }
    };

    const rows: ToggleRow[] = [
        {key: 'executiveSummary', label: formatMessage({defaultMessage: 'Executive summary'}), locked: true},
        {key: 'statusUpdates', label: formatMessage({defaultMessage: 'Status updates'}), locked: true},
        {key: 'timeline', label: formatMessage({defaultMessage: 'Timeline'})},
        {key: 'retrospective', label: formatMessage({defaultMessage: 'Retrospective'})},
        {key: 'checklists', label: formatMessage({defaultMessage: 'Task outline'})},
        {key: 'transcript', label: formatMessage({defaultMessage: 'Complete chat history'})},
    ];

    const toggle = (key: keyof ReportSections) => {
        setSections((prev) => ({...prev, [key]: !prev[key]}));
    };

    const confirmText = exporting ? <FormattedMessage defaultMessage='Exporting…'/> : <FormattedMessage defaultMessage='Export'/>;

    return (
        <GenericModal
            id='export-options-modal'
            modalHeaderText={formatMessage({defaultMessage: 'Export run report'})}
            show={true}
            onHide={cancel}
            handleCancel={cancel}
            handleConfirm={confirm}
            autoCloseOnConfirmButton={false}
            confirmButtonText={confirmText}
            cancelButtonText={<FormattedMessage defaultMessage='Cancel'/>}
            isConfirmDisabled={exporting}
            showCancel={true}
        >
            <Body>
                <FormatSelector>
                    <FormatButton
                        data-testid='format-button-pdf'
                        selected={format === 'pdf'}
                        aria-pressed={format === 'pdf'}
                        onClick={() => setFormat('pdf')}
                    >
                        <i className='icon icon-file-pdf-outline'/>
                        <FormattedMessage defaultMessage='PDF'/>
                    </FormatButton>
                    <FormatButton
                        data-testid='format-button-html'
                        selected={format === 'html'}
                        aria-pressed={format === 'html'}
                        onClick={() => setFormat('html')}
                    >
                        <i className='icon icon-code-tags'/>
                        <FormattedMessage defaultMessage='HTML'/>
                    </FormatButton>
                    <FormatButton
                        data-testid='format-button-md'
                        selected={format === 'md'}
                        aria-pressed={format === 'md'}
                        onClick={() => setFormat('md')}
                    >
                        <i className='icon icon-file-text-outline'/>
                        <FormattedMessage defaultMessage='Markdown'/>
                    </FormatButton>
                </FormatSelector>
                {format === 'pdf' && (
                    <FormatHint data-testid='format-hint'>
                        <FormattedMessage defaultMessage='Choose "Save as PDF" in the print dialog that opens.'/>
                    </FormatHint>
                )}
                <Description>
                    <FormattedMessage defaultMessage="Select what you'd like the export to include:"/>
                </Description>
                <Toggles>
                    {rows.map((row) => (
                        <ToggleLabel
                            key={row.key}
                            data-testid={`section-toggle-${row.key}`}
                            locked={row.locked}
                        >
                            <input
                                type='checkbox'
                                checked={row.locked || Boolean(sections[row.key])}
                                disabled={row.locked}
                                onChange={() => toggle(row.key)}
                            />
                            <span>{row.label}</span>
                        </ToggleLabel>
                    ))}
                </Toggles>
                {sections.transcript && (
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
                <TimeZoneField data-testid='time-zone-field'>
                    <TimeZoneLabel id='export-time-zone-label'>
                        <FormattedMessage defaultMessage='Time zone:'/>
                    </TimeZoneLabel>
                    <StyledSelect
                        aria-labelledby='export-time-zone-label'
                        options={timeZoneOptions}
                        value={timeZoneOptions.find((o) => o.value === timeZone)}
                        onChange={(option: TimeZoneOption | null) => setTimeZone(option?.value ?? '')}
                        formatOptionLabel={formatTimeZoneOption}
                        menuPlacement='auto'
                        menuPortalTarget={document.body}
                        styles={{menuPortal: (base: object) => ({...base, zIndex: 10000})}}
                    />
                </TimeZoneField>
                {channelExportAvailable && (
                    <ChannelExportHint data-testid='channel-export-hint'>
                        <FormattedMessage defaultMessage="Need a CSV transcript? Use channel-export's /export slash command in this run's channel."/>
                    </ChannelExportHint>
                )}
            </Body>
        </GenericModal>
    );
};

export default ExportOptionsModal;

// formatTimeZoneOption puts a clock in front of the picked time zone, but not in the list.
const formatTimeZoneOption = (option: TimeZoneOption, {context}: {context: 'menu' | 'value'}) => {
    if (context === 'menu') {
        return option.label;
    }
    return (
        <TimeZoneValue>
            <ClockOutlineIcon size={18}/>
            {option.label}
        </TimeZoneValue>
    );
};

// timeZoneLabel shows an IANA time zone name, such as America/New_York, as
// "America/New York".
const timeZoneLabel = (timeZone: string) => timeZone.replaceAll('_', ' ');

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

const ToggleLabel = styled.label<{locked?: boolean}>`
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    cursor: ${({locked}) => (locked ? 'default' : 'pointer')};

    input[type='checkbox'] {
        margin: 0;
        cursor: inherit;
    }
`;

const TimeZoneField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
`;

const TimeZoneValue = styled.span`
    display: flex;
    align-items: center;
    gap: 8px;

    svg {
        flex-shrink: 0;
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }
`;

const TimeZoneLabel = styled.span`
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
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
    border: 1.5px solid ${({selected}) => (selected ? 'var(--button-bg, #1c58d9)' : 'rgba(var(--center-channel-color-rgb, 63, 67, 80), 0.16)')};
    background: ${({selected}) => (selected ? 'rgba(var(--button-bg-rgb, 28, 88, 217), 0.08)' : 'transparent')};
    color: ${({selected}) => (selected ? 'var(--button-bg, #1c58d9)' : 'var(--center-channel-color, #3f4350)')};
    font-size: 14px;
    font-weight: ${({selected}) => (selected ? 600 : 400)};
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
