// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled, {css} from 'styled-components';

import {Post} from 'mattermost-redux/types/posts';
import {GlobalState} from 'mattermost-redux/types/store';
import {Channel} from 'mattermost-redux/types/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {currentPlaybookRun} from 'src/selectors';
import PostText from 'src/components/post_text';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {promptUpdateStatus} from 'src/actions';
import {doDelete} from 'src/client';
import {pluginId} from 'src/manifest';
import {CustomPostContainer} from 'src/components/custom_post_styles';

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
    const dismissUrl = `/plugins/${pluginId}/api/v0/runs/${currentRun?.id}/reminder`;
    const dismissBody = JSON.stringify({channel_id: channel.id});

    if (!currentRun) {
        return null;
    }

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
                            currentRun?.playbook_id,
                            props.post.channel_id,
                        ));
                    }}
                >
                    {formatMessage({defaultMessage: 'Post update'})}
                </PostUpdatePrimaryButton>
                <Spacer/>
                <PostUpdateTertiaryButton onClick={() => doDelete(dismissUrl, dismissBody)}>
                    {formatMessage({defaultMessage: 'Dismiss'})}
                </PostUpdateTertiaryButton>
            </Container>
        </>
    );
};

const PostUpdateButtonCommon = css`
    justify-content: center;
    flex: 1;
    max-width: 135px;
`;

const PostUpdatePrimaryButton = styled(PrimaryButton)`
    ${PostUpdateButtonCommon}
`;

const PostUpdateTertiaryButton = styled(TertiaryButton)`
    ${PostUpdateButtonCommon}
`;

const Spacer = styled.div`
    flex-grow: 0;
    flex-shrink: 0;
    width: 12px;
`;

const Container = styled(CustomPostContainer)`
    display: flex;
    flex-direction: row;
    padding: 12px;
`;

const StyledPostText = styled(PostText)`
    margin-bottom: 8px;
`;
