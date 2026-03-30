// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import Tooltip from 'src/components/widgets/tooltip';

import ToggleHint from './toggle_hint';

interface PlaybookLike {
    auto_archive_channel?: boolean;
    channel_mode: string;
}

interface Props {
    playbook: PlaybookLike;
    onChange: (updated: {auto_archive_channel: boolean}) => void;
    disabled?: boolean;
}

const AutoArchiveToggle = ({playbook, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    const autoArchive = playbook.auto_archive_channel ?? false;
    const isLinkedChannel = playbook.channel_mode === 'link_existing_channel';
    const isDisabled = disabled || isLinkedChannel;

    const handleChange = useCallback(() => {
        onChange({auto_archive_channel: !autoArchive});
    }, [autoArchive, onChange]);

    const toggle = (
        <Toggle
            disabled={isDisabled}
            isChecked={autoArchive}
            onChange={handleChange}
        >
            {formatMessage({id: 'playbooks.auto_archive_toggle.label', defaultMessage: 'Auto-archive channel'})}
        </Toggle>
    );

    return (
        <>
            {isLinkedChannel ? (
                <Tooltip
                    id='auto-archive-channel-toggle-tooltip'
                    content={formatMessage({id: 'playbooks.auto_archive_toggle.disabled_tooltip', defaultMessage: 'The channel cannot be auto-archived when linking to an existing channel.'})}
                    placement='top'
                >
                    <span>{toggle}</span>
                </Tooltip>
            ) : toggle}
            {autoArchive && (
                <ToggleBanner data-testid='auto-archive-confirmation-banner'>
                    {formatMessage({id: 'playbooks.auto_archive_toggle.banner_text', defaultMessage: 'The channel will be auto-archived when the run is finished.'})}
                </ToggleBanner>
            )}
            <ToggleHint>
                {formatMessage({id: 'playbooks.auto_archive_toggle.hint_text', defaultMessage: 'Automatically archive the channel when the run is finished.'})}
            </ToggleHint>
        </>
    );
};

export default AutoArchiveToggle;

const ToggleBanner = styled.div`
    margin-top: 8px;
    padding: 8px 12px;
    background: rgba(var(--button-bg-rgb), 0.08);
    border-radius: 4px;
    color: var(--center-channel-color);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
`;
