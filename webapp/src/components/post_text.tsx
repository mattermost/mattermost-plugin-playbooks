// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode, ReactNodeArray} from 'react';
import {useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';

import {ChannelNamesMap} from 'src/types/backstage';
import {UpdateBody} from 'src/components/rhs/rhs_shared';

interface Props {
    text: string;
    children?: ReactNode | ReactNodeArray;
    className?: string;
}

const PostText = (props: Props) => {
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);

    // @ts-ignore
    const {formatText, messageHtmlToComponent} = window.PostUtils;

    const markdownOptions = {
        singleline: false,
        mentionHighlight: true,
        atMentions: true,
        team,
        channelNamesMap,
    };

    return (
        <UpdateBody className={props.className}>
            {messageHtmlToComponent(formatText(props.text, markdownOptions), true, {})}
            {props.children}
        </UpdateBody>
    );
};

export default PostText;
