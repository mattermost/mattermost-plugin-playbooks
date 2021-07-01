// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {pluginId} from 'src/manifest';

// @ts-ignore
const WebappUtils = window.WebappUtils;

export const navigateToUrl = (urlPath: string) => {
    WebappUtils.browserHistory.push(urlPath);
};

export const teamPluginUrl = (teamName: string, urlPath: string) => {
    return `/${teamName}/${pluginId}` + urlPath;
};

export const navigateToTeamPluginUrl = (teamName: string, urlPath: string) => {
    WebappUtils.browserHistory.push(teamPluginUrl(teamName, urlPath));
};

export const teamPluginErrorUrl = (teamName: string, type: string) => {
    return teamPluginUrl(teamName, `/error?type=${type}`);
};

export const pluginUrl = (urlPath: string) => {
    return `/plug/${pluginId}` + urlPath;
};

export const navigateToPluginUrl = (urlPath: string) => {
    WebappUtils.browserHistory.push(pluginUrl(urlPath));
};

export const pluginErrorUrl = (type: string) => {
    return pluginUrl(`/error?type=${type}`);
};

export const handleFormattedTextClick = (e: React.MouseEvent<HTMLElement, MouseEvent>, currentRelativeTeamUrl: string) => {
    // @ts-ignore
    const channelMentionAttribute = e.target.getAttributeNode('data-channel-mention');

    if (channelMentionAttribute) {
        e.preventDefault();
        navigateToUrl(currentRelativeTeamUrl + '/channels/' + channelMentionAttribute.value);
    }
};
