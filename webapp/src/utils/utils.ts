import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import cssVars from 'css-vars-ponyfill';

import {pluginId} from 'src/manifest';

const MOBILE_SCREEN_WIDTH = 768;

export const getFullName = (firstName: string, lastName: string): string => {
    if (firstName && lastName) {
        return firstName + ' ' + lastName;
    } else if (firstName) {
        return firstName;
    } else if (lastName) {
        return lastName;
    }

    return '';
};

export const getUserDescription = (firstName: string, lastName: string, nickName: string): string => {
    if ((firstName || lastName) && nickName) {
        return ` ${getFullName(firstName, lastName)} (${nickName})`;
    } else if (nickName) {
        return ` (${nickName})`;
    } else if (firstName || lastName) {
        return ` ${getFullName(firstName, lastName)}`;
    }

    return '';
};

export const isMobile = () => {
    return window.innerWidth <= MOBILE_SCREEN_WIDTH;
};

export const registerCssVars = (theme: any) => {
    cssVars({
        variables: {
            'center-channel-color-04': changeOpacity(theme.centerChannelColor, 0.04),
            'center-channel-color-72': changeOpacity(theme.centerChannelColor, 0.72),
            'center-channel-bg-88': changeOpacity(theme.centerChannelBg, 0.88),
            'center-channel-color-88': changeOpacity(theme.centerChannelColor, 0.88),
            'center-channel-bg-64': changeOpacity(theme.centerChannelBg, 0.64),
            'center-channel-color-64': changeOpacity(theme.centerChannelColor, 0.64),
            'center-channel-bg-56': changeOpacity(theme.centerChannelBg, 0.56),
            'center-channel-color-56': changeOpacity(theme.centerChannelColor, 0.56),
            'center-channel-color-48': changeOpacity(theme.centerChannelColor, 0.48),
            'center-channel-color-32': changeOpacity(theme.centerChannelColor, 0.32),
            'center-channel-bg-16': changeOpacity(theme.centerChannelBg, 0.16),
            'center-channel-color-24': changeOpacity(theme.centerChannelColor, 0.24),
            'center-channel-color-16': changeOpacity(theme.centerChannelColor, 0.16),
            'center-channel-bg-08': changeOpacity(theme.centerChannelBg, 0.08),

            'button-bg-32': changeOpacity(theme.buttonBg, 0.32),
            'button-color-32': changeOpacity(theme.buttonColor, 0.32),
            'button-bg-24': changeOpacity(theme.buttonBg, 0.24),
            'button-color-24': changeOpacity(theme.buttonColor, 0.24),
            'button-bg-16': changeOpacity(theme.buttonBg, 0.16),
            'button-color-16': changeOpacity(theme.buttonColor, 0.16),
            'button-bg-08': changeOpacity(theme.buttonBg, 0.08),
            'button-color-08': changeOpacity(theme.buttonColor, 0.08),
            'button-bg-72': changeOpacity(theme.buttonBg, 0.72),
            'button-color-72': changeOpacity(theme.buttonColor, 0.72),
            'button-bg-64': changeOpacity(theme.buttonBg, 0.64),
            'button-color-64': changeOpacity(theme.buttonColor, 0.64),
            'button-bg-56': changeOpacity(theme.buttonBg, 0.56),
            'button-color-56': changeOpacity(theme.buttonColor, 0.56),
            'button-bg-48': changeOpacity(theme.buttonBg, 0.48),
            'button-color-48': changeOpacity(theme.buttonColor, 0.48),
            'button-bg-88': changeOpacity(theme.buttonBg, 0.88),
            'button-color-88': changeOpacity(theme.buttonColor, 0.88),

            'link-color-08': changeOpacity(theme.linkColor, 0.08),

        },
    });
};

export const navigateToUrl = (urlPath: string) => {
    WebappUtils.browserHistory.push(urlPath);
};

export const navigateToTeamPluginUrl = (teamName: string, urlPath: string) => {
    let cleanPath = urlPath;
    while (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substr(1);
    }
    WebappUtils.browserHistory.push(`/${teamName}/${pluginId}/` + cleanPath);
};
