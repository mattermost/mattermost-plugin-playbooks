// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {Post} from 'mattermost-redux/types/posts';
import {isSystemMessage} from 'mattermost-redux/utils/post_utils';
import {isCombinedUserActivityPost} from 'mattermost-redux/utils/post_list';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import IncidentPostMenuIcon from 'src/components/assets/icons/post_menu_icon';

import {startIncident} from 'src/actions';

interface Props {
    postId: string;
    theme: Record<string, string>;
}

const StartIncidentPostMenu: FC = (props: Props) => {
    const dispatch = useDispatch();
    const post = useSelector<GlobalState, Post>((state) => getPost(state, props.postId));
    if (!post || isCombinedUserActivityPost(post) || isSystemMessage(post)) {
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
                    onClick={handleClick}
                >
                    <IncidentPostMenuIcon theme={props.theme}/>
                    {'Start incident'}
                </button>
            </li>
        </React.Fragment>
    );
};

export default StartIncidentPostMenu;
