// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import styled from 'styled-components';
import {ContainerProps, components} from 'react-select';

import {Post} from '@mattermost/types/posts';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {useAppDispatch, useAppSelector} from 'src/hooks/redux';

import PostText from 'src/components/post_text';
import {PrimaryButton} from 'src/components/assets/buttons';
import {promptUpdateStatus} from 'src/actions';
import {fetchPlaybookRun, fetchPlaybookRuns, resetReminder} from 'src/client';
import {CustomPostContainer} from 'src/components/custom_post_styles';
import {
    Mode,
    Option,
    ms,
    useMakeOption,
} from 'src/components/datetime_input';
import {nearest} from 'src/utils';
import {StyledSelect} from 'src/components/backstage/styles';
import {useClientRect} from 'src/hooks';
import {PlaybookRun, RunStatus} from 'src/types/playbook_run';

interface Props {
    post: Post;
}

type ReminderRun = Pick<PlaybookRun, 'id' | 'name' | 'previous_reminder' | 'reminder_timer_default_seconds'>;

const UpdateRequestPost = (props: Props) => {
    const dispatch = useAppDispatch();
    const {formatMessage} = useIntl();
    const channel = useAppSelector((state) => getChannel(state, props.post.channel_id));
    const team = useAppSelector((state) => getTeam(state, channel?.team_id ?? ''));
    const targetUsername = typeof props.post.props.targetUsername === 'string' ? props.post.props.targetUsername : '';
    const playbookRunId = typeof props.post.props.playbookRunId === 'string' ? props.post.props.playbookRunId : '';

    const [run, setRun] = useState<ReminderRun | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        const load = async () => {
            try {
                if (playbookRunId) {
                    const fetched = await fetchPlaybookRun(playbookRunId);
                    if (!cancelled) {
                        setRun(fetched);
                    }
                    return;
                }

                // If playbookRunId is missing (could be in old existent reminders), fall back
                // to the first in-progress run for the channel (enough for old
                // one-run-per-channel cases without post props).
                const result = await fetchPlaybookRuns({
                    page: 0,
                    per_page: 1,
                    channel_id: props.post.channel_id,
                    statuses: [RunStatus.InProgress],
                    skip_extras: true,
                    skip_checklists: true,
                });
                if (!cancelled) {
                    setRun(result.items?.[0] ?? null);
                }
            } catch {
                if (!cancelled) {
                    setRun(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [playbookRunId, props.post.channel_id]);

    // Decide whether to open the snooze menu above or below
    const [snoozeMenuPos, setSnoozeMenuPos] = useState('top');
    const [rect, ref] = useClientRect();
    useEffect(() => {
        if (!rect) {
            return;
        }

        setSnoozeMenuPos((rect.top < 250) ? 'bottom' : 'top');
    }, [rect]);

    const makeOption = useMakeOption(Mode.DurationValue);

    if (!team) {
        return null;
    }

    if (loading || !run) {
        return (
            <StyledPostText
                text={props.post.message}
                team={team}
            />
        );
    }

    const options = [
        makeOption({minutes: 60}),
        makeOption({hours: 24}),
        makeOption({days: 7}),
    ];
    const pushIfNotIn = (option: Option) => {
        if (!options.find((o) => ms(option.value) === ms(o.value))) {
            // option doesn't already exist
            options.push(option);
        }
    };
    if (run.previous_reminder) {
        pushIfNotIn(makeOption({seconds: nearest(run.previous_reminder * 1e-9, 1)}));
    }
    if (run.reminder_timer_default_seconds) {
        pushIfNotIn(makeOption({seconds: run.reminder_timer_default_seconds}));
    }
    options.sort((a, b) => ms(a.value) - ms(b.value));

    const snoozeFor = (option: Option) => {
        resetReminder(run.id, ms(option.value) / 1000);
    };

    const SelectContainer = ({children, ...ownProps}: ContainerProps<Option, boolean>) => {
        return (
            <components.SelectContainer
                {...ownProps}

                // @ts-ignore
                innerProps={{...ownProps.innerProps, role: 'button'}}
            >
                {children}
            </components.SelectContainer>
        );
    };

    const playbookRunURL = `/playbooks/runs/${run.id}`;

    return (
        <>
            <StyledPostText
                text={formatMessage({defaultMessage: '@{targetUsername}, please provide a status update for [{runName}]({playbookURL}).'}, {runName: run.name, targetUsername, playbookURL: playbookRunURL})}
                team={team}
            />
            <Container ref={ref}>
                <PostUpdatePrimaryButton
                    onClick={() => {
                        dispatch(promptUpdateStatus(
                            team.id,
                            run.id,
                            props.post.channel_id,
                        ));
                    }}
                >
                    {formatMessage({defaultMessage: 'Post update'})}
                </PostUpdatePrimaryButton>
                <SelectWrapper
                    filterOption={null}
                    isMulti={false}
                    menuPlacement={snoozeMenuPos}
                    components={{
                        IndicatorSeparator: () => null,
                        SelectContainer,
                    }}
                    placeholder={formatMessage({defaultMessage: 'Snooze for…'})}
                    options={options}
                    onChange={snoozeFor}
                    menuPortalTarget={document.body}
                    styles={{
                        control: (base: CSSProperties) => ({
                            ...base,
                            height: '40px',
                            minWidth: '100px',
                        }),
                        menuPortal: (base: CSSProperties) => ({
                            ...base,
                            minWidth: '168px',
                            zIndex: 22,
                        }),
                    }}
                />
            </Container>
        </>
    );
};

const SelectWrapper = styled(StyledSelect)`
    margin: 4px;
`;

const PostUpdatePrimaryButton = styled(PrimaryButton)`
    flex: 1;
    margin: 4px;
`;

const Container = styled(CustomPostContainer)`
    display: flex;
    max-width: 440px;
    flex-flow: row wrap;
    padding: 12px;
`;

const StyledPostText = styled(PostText)`
    margin-bottom: 8px;
`;

export default UpdateRequestPost;
