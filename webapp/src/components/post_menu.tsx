// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';
import {Post} from 'mattermost-redux/types/posts';
import {isSystemMessage} from 'mattermost-redux/utils/post_utils';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import IncidentPostMenuIcon from 'src/components/assets/icons/post_menu_icon';

import {addToTimeline, startIncident, showPostMenuModal} from 'src/actions';

import {useAllowAddMessageToTimelineInCurrentTeam} from 'src/hooks';

import UpgradeBadge from 'src/components/backstage/upgrade_badge';

interface Props {
    postId: string;
}

export const StartIncidentPostMenu: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();
    const post = useSelector<GlobalState, Post>((state) => getPost(state, props.postId));
    if (!post || isSystemMessage(post)) {
        return null;
    }

    const handleClick = () => {
        dispatch(startIncident(props.postId));
    };

    return (
        <React.Fragment>
            <li
                className='MenuItem'
                role='menuitem'
                onClick={handleClick}
            >
                <button
                    data-testid='incidentPostMenuIcon'
                    className='style--none'
                    role='presentation'
                >
                    <IncidentPostMenuIcon/>
                    {'Start incident'}
                </button>
            </li>
        </React.Fragment>
    );
};

export const AttachToIncidentPostMenu: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();
    const allowMessage = useAllowAddMessageToTimelineInCurrentTeam();

    const post = useSelector<GlobalState, Post>((state) => getPost(state, props.postId));
    if (!post || isSystemMessage(post)) {
        return null;
    }

    const handleClick = () => {
        if (allowMessage) {
            dispatch(addToTimeline(props.postId));
        } else {
            dispatch(showPostMenuModal());
        }
    };

    return (
        <React.Fragment>
            <li
                className='MenuItem'
                role='menuitem'
                onClick={handleClick}
            >
                <button
                    data-testid='incidentAddToTimeline'
                    className='style--none'
                    role='presentation'
                >
                    <IncidentPostMenuIcon/>
                    {'Add to incident timeline'}
                    {!allowMessage && <PositionedUpgradeBadge/>}
                </button>
            </li>
        </React.Fragment>
    );
};

const PositionedUpgradeBadge = styled(UpgradeBadge)`
    margin-left: 16px;
    margin-bottom: -3px;
`;
