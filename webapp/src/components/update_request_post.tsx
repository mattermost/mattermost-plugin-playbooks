// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {components, ContainerProps} from 'react-select';

import {Post} from 'mattermost-redux/types/posts';
import {GlobalState} from 'mattermost-redux/types/store';
import {Channel} from 'mattermost-redux/types/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {currentPlaybookRun} from 'src/selectors';
import PostText from 'src/components/post_text';
import {PrimaryButton} from 'src/components/assets/buttons';
import {promptUpdateStatus} from 'src/actions';
import {resetReminder} from 'src/client';
import {CustomPostContainer} from 'src/components/custom_post_styles';
import {makeOption, Mode, ms, Option} from 'src/components/datetime_input';
import {nearest} from 'src/utils';
import {optionFromSeconds} from 'src/components/modals/update_run_status_modal';
import {StyledSelect} from 'src/components/backstage/styles';

interface Props {
    post: Post;
}

export const UpdateRequestPost = (props: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const channel = useSelector<GlobalState, Channel>((state) => getChannel(state, props.post.channel_id));
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, channel.team_id));
    const currentRun = useSelector(currentPlaybookRun);
    const targetUsername = props.post.props.targetUsername ?? '';

    if (!currentRun) {
        return null;
    }

    const options = [
        makeOption('in 60 minutes', Mode.DurationValue),
        makeOption('in 24 hours', Mode.DurationValue),
        makeOption('in 7 days', Mode.DurationValue),
    ];
    const pushIfNotIn = (option: Option) => {
        if (!options.find((o) => ms(option.value) === ms(o.value))) {
            // option doesn't already exist
            options.push(option);
        }
    };
    if (currentRun.previous_reminder) {
        pushIfNotIn(optionFromSeconds(nearest(currentRun.previous_reminder * 1e-9, 1)));
    }
    if (currentRun.reminder_timer_default_seconds) {
        pushIfNotIn(optionFromSeconds(currentRun.reminder_timer_default_seconds));
    }
    options.sort((a, b) => ms(a.value) - ms(b.value));

    const snoozeFor = (option: Option) => {
        resetReminder(currentRun.id, ms(option.value) / 1000);
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

    return (
        <>
            <StyledPostText
                text={formatMessage({defaultMessage: '@{targetUsername}, please provide a status update.'}, {targetUsername})}
                team={team}
            />
            <Container>
                <PostUpdatePrimaryButton
                    onClick={() => {
                        dispatch(promptUpdateStatus(
                            team.id,
                            currentRun?.id,
                            props.post.channel_id,
                        ));
                    }}
                >
                    {formatMessage({defaultMessage: 'Post update'})}
                </PostUpdatePrimaryButton>
                <SelectWrapper
                    filterOption={null}
                    isMulti={false}
                    menuPlacement={'top'}
                    components={{
                        IndicatorSeparator: () => null,
                        SelectContainer,
                    }}
                    placeholder={formatMessage({defaultMessage: 'Snooze'})}
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
                            zIndex: 22,
                        }),
                    }}
                />
            </Container>
        </>
    );
};

const PostUpdateButtonCommon = css`
    justify-content: center;
    flex: 1;
    max-width: 135px;
    margin: 4px;
`;

const SelectWrapper = styled(StyledSelect)`
    margin: 4px;
`;

const PostUpdatePrimaryButton = styled(PrimaryButton)`
    ${PostUpdateButtonCommon}{
    }

    white-space: nowrap;
`;

const Container = styled(CustomPostContainer)`
    display: flex;
    flex-direction: row;
    padding: 12px;
    flex-wrap: wrap;
    max-width: 440px;
`;

const StyledPostText = styled(PostText)`
    margin-bottom: 8px;
`;
