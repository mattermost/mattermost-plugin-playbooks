// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';

import {useSelector} from 'react-redux';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import styled from 'styled-components';

import {useIntl} from 'react-intl';

import {GlobalState} from 'mattermost-redux/types/store';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {DateTime, Duration} from 'luxon';

import GenericModal, {Description, Label} from 'src/components/widgets/generic_modal';

import {
    useDateTimeInput,
    makeOption,
    ms,
    Mode,
    Option,
} from 'src/components/datetime_input';
import {DraftPlaybookWithChecklist, PlaybookWithChecklist} from 'src/types/playbook';

import {usePlaybook, usePost, useRun} from 'src/hooks';
import MarkdownTextbox from '../markdown_textbox';
import {pluginUrl} from 'src/browser_routing';
import {postStatusUpdate} from 'src/client';
import {formatDuration} from '../formatted_duration';
import {PlaybookRun} from 'src/types/playbook_run';
import {roundToNearest} from 'src/utils';
import Tooltip from 'src/components/widgets/tooltip';

const ID = 'playbooks_update_run_status_dialog';

type Props = {
    playbookRunId: string;
    playbookId: string;
    channelId: string;
    hasPermission: boolean;
} & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: UpdateRunStatusModal,
    dialogProps: props,
});

const UpdateRunStatusModal = ({
    playbookRunId,
    playbookId,
    channelId,
    hasPermission,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const [message, setMessage] = useState<string | null>(null);
    const playbook = usePlaybook(playbookId);
    const run = useRun(playbookRunId);
    const lastStatusPostMeta = run?.status_posts?.slice().reverse().find(({delete_at}) => !delete_at);
    const lastStatusPost = usePost(lastStatusPostMeta?.id ?? '');
    if (
        playbook && // playbook is loaded and
        (
            (lastStatusPostMeta && lastStatusPost) || // last status post found
            (run && !lastStatusPostMeta) // or run loaded and there is no last status post
        ) &&
        message == null // and message is empty
    ) {
        setMessage(lastStatusPost?.message ?? playbook.reminder_message_template);
    }
    const currentUserId = useSelector(getCurrentUserId);
    const team = useSelector((state: GlobalState) => playbook && getTeam(state, playbook.team_id));

    const {input: reminderInput, reminder} = useReminderTimer(playbook, run);

    const onConfirm = () => {
        if (hasPermission && message?.trim() && currentUserId && channelId && team) {
            postStatusUpdate(
                playbookRunId,
                {message, reminder},
                {user_id: currentUserId, channel_id: channelId, team_id: team.id}
            );
        }
    };

    const broadcastChannelNames = useSelector((state: GlobalState) => {
        return playbook?.broadcast_channel_ids.reduce<string[]>((result, id) => {
            const displayName = getChannel(state, id)?.display_name;

            if (displayName) {
                result.push(displayName);
            }
            return result;
        }, [])?.join(', ');
    });

    const form = (
        <FormContainer>
            <Description>
                {formatMessage({
                    id: `${ID}_description`,
                    defaultMessage: 'This update will be saved to the <OverviewLink>overview page</OverviewLink>{hasBroadcast, select, true { and broadcast to <ChannelsTooltip>{broadcastChannelCount, plural, =1 {one channel} other {{broadcastChannelCount, number} channels}}</ChannelsTooltip>} other {}}.',
                }, {
                    OverviewLink: (...chunks) => (
                        <Link
                            target='_blank'
                            rel='noopener noreferrer'
                            to={pluginUrl(`/runs/${playbookRunId}`)}
                        >
                            {chunks}
                        </Link>
                    ),
                    ChannelsTooltip: (...chunks) => (
                        <Tooltip
                            id={`${ID}_broadcast_tooltip`}
                            content={broadcastChannelNames}
                        >
                            <span tabIndex={0}>{chunks}</span>
                        </Tooltip>
                    ),
                    hasBroadcast: Boolean(playbook?.broadcast_channel_ids?.length).toString(),
                    broadcastChannelCount: playbook?.broadcast_channel_ids.length ?? 0,
                })}
            </Description>
            <Label>
                {'Change since last update'}
            </Label>
            <MarkdownTextbox
                id='update_run_status_textbox'
                value={message ?? ''}
                setValue={setMessage}
                channelId={channelId}
            />
            <Label>
                {'Timer for next update'}
            </Label>
            {reminderInput}
        </FormContainer>
    );

    const warning = (
        <WarningBlock>
            <span>
                {'You do not have permission to post an update.'}
            </span>
        </WarningBlock>
    );

    return (
        <GenericModal
            modalHeaderText={'Post update'}
            cancelButtonText={hasPermission ? 'Cancel' : 'Close'}
            confirmButtonText={hasPermission ? 'Post' : 'Ok'}
            handleCancel={() => true}
            handleConfirm={hasPermission ? onConfirm : null}
            isConfirmDisabled={!(message?.trim() && currentUserId && channelId && team && hasPermission)}
            {...modalProps}
            id={ID}
        >
            {hasPermission ? form : warning}
        </GenericModal>
    );
};

const optionFromSeconds = (seconds: number) => {
    const duration = Duration.fromObject({seconds});

    return {
        label: `in ${formatDuration(duration, 'long')}`,
        value: duration,
    };
};

export const useReminderTimer = (
    playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist | undefined,
    run: PlaybookRun | undefined
) => {
    const defaults = useMemo(() => {
        const options = [
            makeOption('in 60 minutes', Mode.DurationValue),
            makeOption('in 24 hours', Mode.DurationValue),
            makeOption('in 7 days', Mode.DurationValue),
        ];

        let value: Option | undefined;
        if (playbook && run) {
            // wait until both default value data sources are available

            if (run.previous_reminder) {
                value = optionFromSeconds(roundToNearest(run.previous_reminder * 1e-9, 60));
            }

            if (playbook.reminder_timer_default_seconds) {
                const defaultReminderOption = optionFromSeconds(playbook.reminder_timer_default_seconds);
                if (!options.find((o) => ms(o.value) === ms(defaultReminderOption.value))) {
                    // don't duplicate an option that exists already
                    options.push(defaultReminderOption);
                }

                if (!value && !run.status_posts.some(({delete_at}) => !delete_at)) {
                    // set preselected-default if it was not set previously
                    // and there are no previous status posts (excluding deleted)
                    // (the previous reminder timer specified take precedence)
                    value = defaultReminderOption;
                }
            }

            const matched = options.find((o) => value && ms(o.value) === ms(value.value));
            if (matched) {
                // don't duplicate an option that exists already
                value = matched;
            } else if (value) {
                options.push(value);
            }
            options.sort((a, b) => ms(a.value) - ms(b.value));
        }

        return {options, value};
    }, [playbook, run]);

    const {input, value} = useDateTimeInput({
        mode: Mode.DateTimeValue,
        parsingOptions: {forwardDate: true, defaultUnit: 'minutes'},
        defaultOptions: defaults.options,
        defaultValue: defaults.value,
        id: 'reminder_timer_datetime',
    });

    let reminder;
    if (value?.value) {
        reminder = (Duration.isDuration(value.value) ? value.value : value.value.diff(DateTime.now())).as('seconds');
    }

    return {input, reminder};
};

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    color: var(--center-channel-color);
    ${Description} {
        span {
            text-decoration: underline;
            font-weight: bold;
        }
    }
`;

const WarningBlock = styled.div`
    padding: 2rem;
    display: flex;
    place-content: center;
    span {
        padding: 1.5rem;
    }
`;

export default UpdateRunStatusModal;
