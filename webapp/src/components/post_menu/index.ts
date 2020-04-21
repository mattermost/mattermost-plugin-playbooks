// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {isCombinedUserActivityPost} from 'mattermost-redux/utils/post_list';
import {isSystemMessage} from 'mattermost-redux/utils/post_utils';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {startIncident} from 'src/actions';

import StartIncidentPostMenu from './post_menu';

interface Props {
    postId: string;
}

function mapStateToProps(state: GlobalState, props: Props) {
    const post = getPost(state, props.postId);
    const oldSystemMessageOrNull = post ? isSystemMessage(post) : true;
    const systemMessage = isCombinedUserActivityPost(post) || oldSystemMessageOrNull;

    return {
        postId: props.postId,
        isSystemMessage: systemMessage,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            startIncident,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(StartIncidentPostMenu);

