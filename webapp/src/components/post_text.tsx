// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode, ReactNodeArray} from 'react';
import {useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';
import {Team} from '@mattermost/types/teams';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {ChannelNamesMap} from 'src/types/backstage';
import {UpdateBody} from 'src/components/rhs/rhs_shared';

interface Props {
    text: string;
    team: Team;
    children?: ReactNode | ReactNodeArray;
    className?: string;
}

const PostText = (props: Props) => {
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const siteURL = useSelector<GlobalState, string>((state) => getConfig(state).SiteURL || '');

    // @ts-ignore
    const {formatText, messageHtmlToComponent, handleFormattedTextClick} = window.PostUtils;

    const markdownOptions = {
        singleline: false,
        mentionHighlight: true,
        atMentions: true,
        team: props.team,
        channelNamesMap,
        siteURL,
    };

    const messageHtmlToComponentOptions = {
        hasPluginTooltips: true,
    };

    // Older versions of the web app may not export handleFormattedTextClick, so we need to check for it.
    const onClick = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
        if (handleFormattedTextClick) {
            handleFormattedTextClick(e);
        }
    };

    const formattedText = formatText(props.text, markdownOptions);
    return (
        <UpdateBody className={props.className}>
            <div onClick={onClick}>
                {messageHtmlToComponent(formattedText, true, messageHtmlToComponentOptions)}
            </div>
            {props.children}
        </UpdateBody>
    );
};

export default PostText;
