// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {
    BackstageSubheader,
    BackstageSubheaderDescription,
    StyledMarkdownTextbox,
    TabContainer,
} from 'src/components/backstage/styles';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import DefaultUpdateTimer from 'src/components/backstage/default_update_timer';
import {
    BackstageGroupToggleHeader,
    Section,
    SectionTitle,
    Setting,
    SidebarBlock,
} from 'src/components/backstage/playbook_edit/styles';
import {DraftPlaybookWithChecklist, PlaybookWithChecklist} from 'src/types/playbook';
import {Broadcast} from 'src/components/backstage/playbook_edit/automation/broadcast';
import {PatternedTextArea} from 'src/components/backstage/playbook_edit/automation/patterned_text_area';

interface Props {
    playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist;
    setPlaybook: React.Dispatch<React.SetStateAction<DraftPlaybookWithChecklist | PlaybookWithChecklist>>;
    setChangesMade: (b: boolean) => void;
}

const StatusUpdatesEdit = ({playbook, setPlaybook, setChangesMade}: Props) => {
    const {formatMessage} = useIntl();

    const handleToggleBroadcastChannels = () => {
        setPlaybook({
            ...playbook,
            broadcast_enabled: !playbook.broadcast_enabled && playbook.status_update_enabled,
        });
        setChangesMade(true);
    };

    const handleBroadcastChannelSelected = (channelIds: string[]) => {
        // assumes no repeated elements on any of the arrays
        if (channelIds.length !== playbook.broadcast_channel_ids.length || channelIds.some((id) => !playbook.broadcast_channel_ids.includes(id))) {
            setPlaybook({
                ...playbook,
                broadcast_channel_ids: channelIds,
            });
            setChangesMade(true);
        }
    };

    const handleToggleWebhookOnStatusUpdate = () => {
        setPlaybook({
            ...playbook,
            webhook_on_status_update_enabled: !playbook.webhook_on_status_update_enabled && playbook.status_update_enabled,
        });
        setChangesMade(true);
    };

    const handleWebhookOnStatusUpdateChange = (urls: string) => {
        setPlaybook({
            ...playbook,
            webhook_on_status_update_urls: urls.split('\n'),
        });
        setChangesMade(true);
    };

    return (
        <TabContainer>
            <SidebarBlock>
                <BackstageGroupToggleHeader id={'status-updates'}>
                    <Toggle
                        isChecked={playbook.status_update_enabled}
                        onChange={() => {
                            setPlaybook({
                                ...playbook,
                                status_update_enabled: !playbook.status_update_enabled,
                                webhook_on_status_update_enabled: playbook.webhook_on_status_update_enabled && !playbook.status_update_enabled,
                                broadcast_enabled: playbook.broadcast_enabled && !playbook.status_update_enabled,
                            });
                            setChangesMade(true);
                        }}
                    />
                    {formatMessage({defaultMessage: 'Enable status updates'})}
                </BackstageGroupToggleHeader>
            </SidebarBlock>
            <SidebarBlock id={'default-update-timer'}>
                <DefaultUpdateTimer
                    seconds={playbook.reminder_timer_default_seconds}
                    setSeconds={(seconds: number) => {
                        if (seconds !== playbook.reminder_timer_default_seconds &&
                            seconds > 0) {
                            setPlaybook({
                                ...playbook,
                                reminder_timer_default_seconds: seconds,
                            });
                        }
                    }}
                    disabled={!playbook.status_update_enabled}
                />
            </SidebarBlock>
            <SidebarBlock id={'status-update-text'}>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Status updates'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'This template helps to standardize the format for recurring updates that take place throughout each run to keep.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <StyledMarkdownTextbox
                    className={'playbook_reminder_message'}
                    id={'playbook_reminder_message_edit'}
                    placeholder={formatMessage({defaultMessage: 'Use Markdown to create a template.'})}
                    value={playbook.reminder_message_template}
                    setValue={(value: string) => {
                        setPlaybook({
                            ...playbook,
                            reminder_message_template: value,
                        });
                        setChangesMade(true);
                    }}
                    disabled={!playbook.status_update_enabled}
                />
            </SidebarBlock>
            <Section>
                <SectionTitle>
                    {formatMessage({defaultMessage: 'When an update is posted'})}
                </SectionTitle>
                <Setting id={'broadcast-channels'}>
                    <Broadcast
                        enabled={playbook.broadcast_enabled && playbook.status_update_enabled}
                        onToggle={handleToggleBroadcastChannels}
                        channelIds={playbook.broadcast_channel_ids}
                        onChannelsSelected={handleBroadcastChannelSelected}
                    />
                </Setting>
                <Setting id={'playbook-run-status-update__outgoing-webhook'}>
                    <PatternedTextArea
                        enabled={playbook.webhook_on_status_update_enabled && playbook.status_update_enabled}
                        onToggle={handleToggleWebhookOnStatusUpdate}
                        input={playbook.webhook_on_status_update_urls.join('\n')}
                        onChange={handleWebhookOnStatusUpdateChange}
                        pattern={'https?://.*'}
                        delimiter={'\n'}
                        maxLength={1000}
                        rows={3}
                        placeholderText={formatMessage({defaultMessage: 'Enter webhook'})}
                        textOnToggle={formatMessage({defaultMessage: 'Send outgoing webhook (One per line)'})}
                        errorText={formatMessage({defaultMessage: 'Invalid webhook URLs'})}
                        maxRows={64}
                        maxErrorText={formatMessage({defaultMessage: 'Invalid entry: the maximum number of webhooks allowed is 64'})}
                    />
                </Setting>
            </Section>
        </TabContainer>
    );
};

export default StatusUpdatesEdit;
