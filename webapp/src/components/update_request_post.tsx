// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
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
import {DestructiveButton, TertiaryButton} from 'src/components/assets/buttons';
import {promptUpdateStatus} from 'src/actions';
import {doDelete} from 'src/client';
import {pluginId} from 'src/manifest';

interface Props {
    post: Post;
}

export const UpdateRequestPost = (props: Props) => {
    const dispatch = useDispatch();
    const channel = useSelector<GlobalState, Channel>((state) => getChannel(state, props.post.channel_id));
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, channel.team_id));
    const currentRun = useSelector(currentPlaybookRun);
    const targetUsername = props.post.props.targetUsername ?? '';
    const playbookId = currentRun?.id;
    const dismissUrl = `/plugins/${pluginId}/api/v0/runs/${playbookId}/reminder`;
    const dismissBody = JSON.stringify({channel_id: channel.id});

    return (
        <>
            <StyledPostText
                text={`@${targetUsername}, please provide a status update.`}
                team={team}
            />
            <Container>
                <PostUpdateDestructiveButton
                    onClick={() => {
                        dispatch(promptUpdateStatus(
                            team.id,
                            playbookId,
                            currentRun?.playbook_id,
                            props.post.channel_id,
                        ));
                    }}
                >
                    {'Post update'}
                </PostUpdateDestructiveButton>
                <Spacer/>
                <PostUpdateTertiaryButton onClick={() => doDelete(dismissUrl, dismissBody)}>
                    {'Dismiss'}
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

const PostUpdateDestructiveButton = styled(DestructiveButton)`
    ${PostUpdateButtonCommon}
`;

const PostUpdateTertiaryButton = styled(TertiaryButton)`
    ${PostUpdateButtonCommon}
`;

const Spacer = styled.div`
    flex-grow: 0;
    flex-shrink: 0;
    width: 18px;
`;

const Container = styled.div`
    display: flex;
    flex-direction: row;
`;

const StyledPostText = styled(PostText)`
    margin-bottom: 8px;
`;
