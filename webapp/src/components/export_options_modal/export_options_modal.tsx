// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';

import GenericModal from 'src/components/widgets/generic_modal';

export type Surface = 'run' | 'playbook';

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
    onConfirm: (sections: SectionFlags) => void;
    onCancel: () => void;
    channelExportAvailable?: boolean;
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

const ExportOptionsModal = ({surface, defaults, onConfirm, onCancel, channelExportAvailable = false}: ExportOptionsModalProps) => {
    const {formatMessage} = useIntl();
    const baseDefaults = surface === 'run' ? RUN_DEFAULTS : PLAYBOOK_DEFAULTS;
    const [sections, setSections] = useState<SectionFlags>({...baseDefaults, ...defaults});

    const rows: ToggleRow[] = surface === 'run' ? [
        {key: 'cover', label: formatMessage({defaultMessage: 'Cover page'})},
        {key: 'executiveSummary', label: formatMessage({defaultMessage: 'Executive summary'})},
        {key: 'timeline', label: formatMessage({defaultMessage: 'Timeline'})},
        {key: 'statusUpdates', label: formatMessage({defaultMessage: 'Status updates'})},
        {key: 'checklists', label: formatMessage({defaultMessage: 'Checklists'})},
        {key: 'retrospective', label: formatMessage({defaultMessage: 'Retrospective'})},
        {key: 'transcript', label: formatMessage({defaultMessage: 'Channel transcript'})},
    ] : [
        {key: 'playbookOverview', label: formatMessage({defaultMessage: 'Overview'})},
        {key: 'playbookChecklistTemplates', label: formatMessage({defaultMessage: 'Checklist templates'})},
        {key: 'playbookSettings', label: formatMessage({defaultMessage: 'Settings & automations'})},
    ];

    const toggle = (key: keyof SectionFlags) => {
        setSections((prev) => ({...prev, [key]: !prev[key]}));
    };

    const anySelected = rows.some((r) => sections[r.key]);

    const headerText = surface === 'run' ?
        formatMessage({defaultMessage: 'Download run as PDF'}) :
        formatMessage({defaultMessage: 'Download playbook as PDF'});

    return (
        <GenericModal
            id='export-options-modal'
            modalHeaderText={headerText}
            show={true}
            onHide={onCancel}
            handleCancel={onCancel}
            handleConfirm={() => onConfirm(sections)}
            confirmButtonText={<FormattedMessage defaultMessage='Download'/>}
            cancelButtonText={<FormattedMessage defaultMessage='Cancel'/>}
            isConfirmDisabled={!anySelected}
            showCancel={true}
        >
            <Body>
                <Description>
                    <FormattedMessage defaultMessage='Select the sections to include in the PDF.'/>
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
                {surface === 'run' && channelExportAvailable && (
                    <ChannelExportHint data-testid='channel-export-hint'>
                        <FormattedMessage defaultMessage='Need a CSV transcript? Use channel-export’s /export slash command in this run’s channel.'/>
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
