// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {Duration} from 'luxon';

import FormattedMarkdown, {useDefaultMarkdownOptions} from 'src/components/formatted_markdown';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {messageHtmlToComponent, formatText} from 'src/webapp_globals';

import {TextBadge, ChannelBadge} from 'src/components/backstage/playbooks/playbook_preview_badges';
import {Card, CardEntry, CardSubEntry} from 'src/components/backstage/playbooks/playbook_preview_cards';
import Section from 'src/components/backstage/playbooks/playbook_preview_section';
import {formatDuration} from 'src/components/formatted_duration';

interface Props {
    id: string;
    playbook: PlaybookWithChecklist;
}

const PlaybookPreviewStatusUpdates = (props: Props) => {
    const {formatMessage} = useIntl();

    // The following booleans control the rendering of each of the CardEntry comopnents in this section,
    // hiding them if they don't have any visible subentries.
    // If a new CardSubEntry is added or the conditions are changed, these booleans need to be updated.

    const updateReminderEnabled = props.playbook.reminder_timer_default_seconds !== 0;
    const updateTemplateEnabled = props.playbook.reminder_message_template !== '';

    const showReminderCardEntry =
        updateReminderEnabled ||
        updateTemplateEnabled;

    const broadcastEnabled = props.playbook.broadcast_enabled && props.playbook.broadcast_channel_ids.length !== 0;
    const webhookOnStatusUpdateEnabled = props.playbook.webhook_on_status_update_enabled && props.playbook.webhook_on_status_update_urls.length !== 0;

    const showUpdatePostCardEntryemptyUpdatePostedEntry =
        broadcastEnabled ||
        webhookOnStatusUpdateEnabled;

    const allEmpty =
        !showReminderCardEntry &&
        !showUpdatePostCardEntryemptyUpdatePostedEntry;

    if (allEmpty || !props.playbook.status_update_enabled) {
        return null;
    }

    return (
        <Section
            id={props.id}
            title={formatMessage({defaultMessage: 'Status updates'})}
        >
            <Card>
                <CardEntry
                    title={formatMessage(
                        {defaultMessage: 'The owner will {reminderEnabled, select, true {be prompted to provide a status update every} other {not be prompted to provide a status update}}'},
                        {reminderEnabled: props.playbook.reminder_timer_default_seconds !== 0},
                    )}
                    iconName={'clock-outline'}
                    extraInfo={updateReminderEnabled && (
                        <TextBadge>
                            {formatDuration(Duration.fromObject({seconds: props.playbook.reminder_timer_default_seconds}), 'long')}
                        </TextBadge>
                    )}
                    enabled={showReminderCardEntry}
                >
                    <CardSubEntry
                        title={formatMessage({
                            defaultMessage: 'Update template',
                        })}
                        enabled={updateTemplateEnabled}
                    >
                        <FormattedMarkdown value={props.playbook.reminder_message_template}/>
                    </CardSubEntry>
                </CardEntry>
                <CardEntry
                    title={formatMessage({
                        defaultMessage: 'When an update is posted',
                    })}
                    iconName={'message-check-outline'}
                    enabled={showUpdatePostCardEntryemptyUpdatePostedEntry}
                >
                    <CardSubEntry
                        title={formatMessage(
                            {defaultMessage: 'Broadcast updates in the {oneChannel, plural, one {channel} other {channels}}'},
                            {oneChannel: props.playbook.broadcast_channel_ids.length}
                        )}
                        enabled={broadcastEnabled}
                        extraInfo={props.playbook.broadcast_channel_ids.map((id) => (
                            <ChannelBadge
                                key={id}
                                channelId={id}
                            />
                        ))}
                    />
                    <CardSubEntry
                        title={formatMessage({
                            defaultMessage: 'Send an outgoing webhook',
                        })}
                        enabled={webhookOnStatusUpdateEnabled}
                    >
                        {props.playbook.webhook_on_status_update_urls.map((url) => (<p key={url}>{url}</p>))}
                    </CardSubEntry>
                </CardEntry>
            </Card>
        </Section>
    );
};

export default PlaybookPreviewStatusUpdates;
