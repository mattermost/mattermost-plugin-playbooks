// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {DateTime, Duration} from 'luxon';

import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import GenericModal, {Description, Label} from 'src/components/widgets/generic_modal';
import {
    useDateTimeInput,
    makeOption,
    ms,
    Mode,
    Option,
} from 'src/components/datetime_input';
import {usePost, useRun} from 'src/hooks';
import MarkdownTextbox from '../markdown_textbox';
import {pluginUrl} from 'src/browser_routing';
import {postStatusUpdate} from 'src/client';
import {formatDuration} from '../formatted_duration';
import {PlaybookRun} from 'src/types/playbook_run';
import {nearest} from 'src/utils';
import Tooltip from 'src/components/widgets/tooltip';
import WarningIcon from '../assets/icons/warning_icon';
import CheckboxInput from 'src/components/backstage/runs_list/checkbox_input';
import {VerticalSpacer} from 'src/components/backstage/playbook_runs/shared';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';
import {modals} from 'src/webapp_globals';
import {Checklist, ChecklistItemState} from 'src/types/playbook';

const ID = 'playbooks_update_run_status_dialog';

type Props = {
    playbookRunId: string;
    channelId: string;
    hasPermission: boolean;
    reopenWithState: (message?: string, reminderInSeconds?: number, finishRunChecked?: boolean) => void;
    message?: string,
    reminderInSeconds?: number,
    finishRunChecked?: boolean,
} & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: UpdateRunStatusModal,
    dialogProps: props,
});

const UpdateRunStatusModal = ({
    playbookRunId,
    channelId,
    hasPermission,
    reopenWithState,
    message: providedMessage,
    reminderInSeconds: providedReminder,
    finishRunChecked: providedFinishRunChecked,
    ...modalProps
}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const run = useRun(playbookRunId);

    const [message, setMessage] = useState(providedMessage);
    const defaultMessage = useDefaultMessage(run);
    if (message == null && defaultMessage) {
        setMessage(defaultMessage);
    }

    const [showModal, setShowModal] = useState(true);
    const [finishRun, setFinishRun] = useState(providedFinishRunChecked || false);

    const {input: reminderInput, reminder} = useReminderTimerOption(run, finishRun, providedReminder);
    const isReminderValid = finishRun || (reminder && reminder > 0);
    let warningMessage = formatMessage({defaultMessage: 'Date must be in the future.'});
    if (!reminder || reminder === 0) {
        warningMessage = formatMessage({defaultMessage: 'Please specify a future date/time for the update reminder.'});
    }

    const broadcastChannelNames = useSelector((state: GlobalState) => {
        return run?.broadcast_channel_ids.reduce<string[]>((result, id) => {
            const displayName = getChannel(state, id)?.display_name;

            if (displayName) {
                result.push(displayName);
            }
            return result;
        }, [])?.join(', ');
    });

    const outstanding = outstandingTasks(run?.checklists || []);
    let confirmationMessage = formatMessage({defaultMessage: 'Are you sure you want to finish the run?'});
    if (outstanding > 0) {
        confirmationMessage = formatMessage(
            {defaultMessage: 'There {outstanding, plural, =1 {is # outstanding task} other {are # outstanding tasks}}. Are you sure you want to finish the run?'},
            {outstanding});
    }

    const onConfirm = () => {
        if (hasPermission && message?.trim() && currentUserId && channelId && run?.team_id) {
            postStatusUpdate(
                playbookRunId,
                {message, reminder, finishRun},
                {user_id: currentUserId, channel_id: channelId, team_id: run?.team_id}
            );
            setShowModal(false);
        }
    };

    const onSubmit = () => {
        if (finishRun) {
            setShowModal(false);

            dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
                show: true,
                title: formatMessage({defaultMessage: 'Confirm finish run'}),
                message: confirmationMessage,
                confirmButtonText: formatMessage({defaultMessage: 'Finish run'}),
                onConfirm,
                onCancel: () => {
                    reopenWithState(message, reminder, finishRun);
                    setShowModal(true);
                },
            })));
        } else {
            onConfirm();
        }
    };

    const form = (
        <FormContainer>
            <Description>
                {formatMessage({
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
                    hasBroadcast: Boolean(run?.broadcast_channel_ids?.length).toString(),
                    broadcastChannelCount: run?.broadcast_channel_ids.length ?? 0,
                })}
            </Description>
            <Label>
                {formatMessage({defaultMessage: 'Change since last update'})}
            </Label>
            <MarkdownTextbox
                id='update_run_status_textbox'
                value={message ?? ''}
                setValue={setMessage}
                channelId={channelId}
            />
            <Label>
                {formatMessage({defaultMessage: 'Timer for next update'})}
            </Label>
            {reminderInput}
            {!isReminderValid &&
            <WarningLine>
                <WarningIcon/> {warningMessage}
            </WarningLine>
            }
            <VerticalSpacer size={24}/>
            <StyledCheckboxInput
                testId={'mark-run-as-finished'}
                text={formatMessage({defaultMessage: 'Also mark the run as finished'})}
                checked={finishRun}
                onChange={(checked) => setFinishRun(checked)}
            />
        </FormContainer>
    );

    const warning = (
        <WarningBlock>
            <span>
                {formatMessage({defaultMessage: 'You do not have permission to post an update.'})}
            </span>
        </WarningBlock>
    );

    return (
        <GenericModal
            show={showModal}
            modalHeaderText={formatMessage({defaultMessage: 'Post update'})}
            cancelButtonText={hasPermission ? formatMessage({defaultMessage: 'Cancel'}) : formatMessage({defaultMessage: 'Close'})}
            confirmButtonText={hasPermission ? formatMessage({defaultMessage: 'Post update'}) : formatMessage({defaultMessage: 'Ok'})}
            handleCancel={() => true}
            handleConfirm={hasPermission ? onSubmit : null}
            autoCloseOnConfirmButton={false}
            isConfirmDisabled={!(hasPermission && message?.trim() && currentUserId && channelId && run?.team_id && isReminderValid)}
            {...modalProps}
            id={ID}
        >
            {hasPermission ? form : warning}
        </GenericModal>
    );
};

const useDefaultMessage = (run: PlaybookRun | null | undefined) => {
    const lastStatusPostMeta = run?.status_posts?.slice().reverse().find(({delete_at}) => !delete_at);
    const lastStatusPost = usePost(lastStatusPostMeta?.id ?? '');

    if (lastStatusPostMeta) {
        // last status exist and should have a post-message
        return lastStatusPost?.message;
    }
    if (run && !lastStatusPostMeta) {
        // run loaded and was no last status post, but there might be a message template
        return run.reminder_message_template;
    }

    return null;
};

export const optionFromSeconds = (seconds: number) => {
    const duration = Duration.fromObject({seconds});

    return {
        label: `in ${formatDuration(duration, 'long')}`,
        value: duration,
    };
};

export const useReminderTimerOption = (run: PlaybookRun | null | undefined, disabled?: boolean, preselectedValue?: number) => {
    const defaults = useMemo(() => {
        const options = [
            makeOption('in 60 minutes', Mode.DurationValue),
            makeOption('in 24 hours', Mode.DurationValue),
            makeOption('in 7 days', Mode.DurationValue),
        ];

        let value: Option | undefined;
        if (preselectedValue) {
            value = optionFromSeconds(preselectedValue);
        }
        if (run) {
            if (!value && run.previous_reminder) {
                value = optionFromSeconds(nearest(run.previous_reminder * 1e-9, 60));
            }

            if (run.reminder_timer_default_seconds) {
                const defaultReminderOption = optionFromSeconds(run.reminder_timer_default_seconds);
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
        }

        const matched = options.find((o) => value && ms(o.value) === ms(value.value));
        if (matched) {
            // don't duplicate an option that exists already
            value = matched;
        } else if (value) {
            options.push(value);
        }
        options.sort((a, b) => ms(a.value) - ms(b.value));

        return {options, value};
    }, [run, preselectedValue]);

    const {input, value} = useDateTimeInput({
        mode: Mode.DateTimeValue,
        parsingOptions: {forwardDate: true, defaultUnit: 'minutes'},
        defaultOptions: defaults.options,
        defaultValue: defaults.value,
        id: 'reminder_timer_datetime',
        disabled,
    });

    let reminder = 0;
    if (value?.value) {
        reminder = (Duration.isDuration(value.value) ? value.value : value.value.diff(DateTime.now())).as('seconds');
    }

    return {input, reminder};
};

const outstandingTasks = (checklists: Checklist[]) => {
    let count = 0;
    for (const list of checklists) {
        for (const item of list.items) {
            if (item.state !== ChecklistItemState.Closed) {
                count++;
            }
        }
    }
    return count;
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

const WarningLine = styled.p`
    color: var(--error-text);
    margin-top: 0.6rem;
`;

const StyledCheckboxInput = styled(CheckboxInput)`
    padding: 10px 16px 10px 0;

    &:hover {
        background-color: transparent;
    }
`;

export default UpdateRunStatusModal;
