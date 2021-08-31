// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';

import {useSelector} from 'react-redux';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import styled from 'styled-components';

import {useIntl} from 'react-intl';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {GlobalState} from 'mattermost-redux/types/store';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import luxon, {DateTime, Duration} from 'luxon';

import GenericModal, {Description, Label} from 'src/components/widgets/generic_modal';

import {
    useDateTimeInput,
    makeOption,
    ms,
    Mode,
    Option,
} from 'src/components/datetime_input';
import {DraftPlaybookWithChecklist, PlaybookWithChecklist} from 'src/types/playbook';

import {usePlaybook} from 'src/hooks';
import MarkdownTextbox from '../markdown_textbox';
import {pluginUrl} from 'src/browser_routing';
import {postStatusUpdate} from 'src/client';
import {renderDuration} from '../duration';

const ID = 'playbooks_update_run_status_dialog';

export const useReminderTimer = (
    playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist | undefined,
    mode: Mode.DateTimeValue | Mode.DurationValue,
) => {
    const defaults = useMemo(() => {
        const options = [
            makeOption(mode === Mode.DateTimeValue ? 'in 60 minutes' : '60 minutes', mode),
            makeOption(mode === Mode.DateTimeValue ? 'in 24 hours' : '24 hours', mode),
            makeOption(mode === Mode.DateTimeValue ? 'in 7 days' : '7 days', mode),
        ];

        let value: Option | undefined;
        if (playbook?.reminder_timer_default_seconds) {
            const defaultReminderDuration = Duration.fromObject({seconds: playbook.reminder_timer_default_seconds});
            let label;
            if (mode === Mode.DateTimeValue) {
                label = DateTime.now().plus(defaultReminderDuration).toRelative({locale: 'en', padding: 5_000});
            } else {
                label = renderDuration(defaultReminderDuration, 'long');
            }

            value = {label, value: defaultReminderDuration, mode};

            const found = options.find((o) => value && ms(o.value) === ms(value.value));

            if (found) {
                value = found;
            } else if (value) {
                options.push(value);
            }
        }

        options.sort((a, b) => ms(a.value) - ms(b.value));
        return {options, value};
    }, [playbook]);

    const {input, value} = useDateTimeInput({
        mode,
        parsingOptions: {forwardDate: true, defaultUnit: 'minutes'},
        defaultOptions: defaults.options,
        defaultValue: defaults.value,
    });

    let reminder;
    if (value?.value) {
        reminder = (Duration.isDuration(value.value) ? value.value : value.value.diff(DateTime.now())).as('seconds');
    }

    return {input, reminder};
};

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
    if (playbook && message == null) {
        setMessage(playbook.reminder_message_template);
    }
    const currentUserId = useSelector(getCurrentUserId);
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId) || {display_name: 'Unknown Channel', id: channelId});
    const team = useSelector((state: GlobalState) => playbook && getTeam(state, playbook.team_id));

    const {input: reminderInput, reminder} = useReminderTimer(playbook, Mode.DateTimeValue);

    const onConfirm = () => {
        if (!message || !hasPermission) {
            return false;
        }
        if (message && currentUserId && channel && team) {
            postStatusUpdate(playbookRunId, {message, reminder}, {user_id: currentUserId, channel_id: channel.id, team_id: team.id});
        }
        return true;
    };

    const form = (
        <FormContainer>
            <Description>
                {formatMessage({
                    id: `${ID}_description`,
                    defaultMessage: 'This update will be saved to the <OverviewLink>overview page</OverviewLink>{hasBroadcast, select, true { and broadcast to {broadcastChannel}} other {}}.',
                }, {
                    OverviewLink: (...chunks) => {
                        return (
                            <Link
                                target='_blank'
                                rel='noopener noreferrer'
                                to={pluginUrl(`/runs/${playbookRunId}`)}
                            >
                                {chunks}
                            </Link>
                        );
                    },
                    hasBroadcast: playbook?.broadcast_channel_id ? 'true' : 'false',
                    broadcastChannel: team && channel && (
                        <Link
                            target='_blank'
                            rel='noopener noreferrer'
                            to={`/${team.name}/channels/${channel.id}`}
                        >
                            {`~${channel.name}`}
                        </Link>
                    ),
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
            isConfirmDisabled={!(message && currentUserId && channel && team && hasPermission)}
            {...modalProps}
            id={ID}
        >
            {hasPermission ? form : warning}
        </GenericModal>
    );
};

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    color: var(--center-channel-color);
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
