import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import cssVars from 'css-vars-ponyfill';

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

export const isExportPluginLoaded = () => {
    const exportPluginId = 'com.mattermost.plugin-channel-export';

    // @ts-ignore
    return Boolean(window.plugins[exportPluginId]);
};

export const registerCssVars = (theme: any) => {
    cssVars({
        variables: {
            'center-channel-color-16': changeOpacity(theme.centerChannelColor, 0.16),
            'center-channel-color-04': changeOpacity(theme.centerChannelColor, 0.04),
            'center-channel-color-72': changeOpacity(theme.centerChannelColor, 0.72),
            'center-channel-color-56': changeOpacity(theme.centerChannelColor, 0.56),
        },
    });
};
