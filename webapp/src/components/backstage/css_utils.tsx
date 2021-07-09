import {
    changeOpacity,
} from 'mattermost-redux/utils/theme_utils';
import cssVars from 'css-vars-ponyfill';

export function applyTheme(theme: any) {
    cssVars({
        variables: {
            'button-bg-rgb': toRgbValues(theme.buttonBg),
            'button-bg': theme.buttonBg,
            'button-bg-24': changeOpacity(theme.buttonBg, 0.24),
            'button-bg-08': changeOpacity(theme.buttonBg, 0.08),
            'button-color': theme.buttonColor,

            'center-channel-color-rgb': toRgbValues(theme.centerChannelColor),
            'center-channel-bg-rgb': toRgbValues(theme.centerChannelBg),
            'center-channel-bg': theme.centerChannelBg,
            'center-channel-color': theme.centerChannelColor,
            'center-channel-color-90': changeOpacity(theme.centerChannelColor, 0.9),
            'center-channel-color-72': changeOpacity(theme.centerChannelColor, 0.72),
            'center-channel-color-64': changeOpacity(theme.centerChannelColor, 0.64),
            'center-channel-color-56': changeOpacity(theme.centerChannelColor, 0.56),
            'center-channel-color-40': changeOpacity(theme.centerChannelColor, 0.4),
            'center-channel-color-24': changeOpacity(theme.centerChannelColor, 0.24),
            'center-channel-color-20': changeOpacity(theme.centerChannelColor, 0.2),
            'center-channel-color-16': changeOpacity(theme.centerChannelColor, 0.16),
            'center-channel-color-08': changeOpacity(theme.centerChannelColor, 0.08),
            'center-channel-color-04': changeOpacity(theme.centerChannelColor, 0.04),

            'link-color': theme.linkColor,
            'mention-highlight-link': theme.mentionHighlightLink,

            'online-indicator-rgb': toRgbValues(theme.onlineIndicator),
            'online-indicator': theme.onlineIndicator,
            'away-indicator': theme.awayIndicator,
            'dnd-indicator': theme.dndIndicator,

            'error-text': theme.errorTextColor,
            'error-text-color-rgb': toRgbValues(theme.errorTextColor),
            'sidebar-text': theme.sidebarText,
        },
    });
}

// given '#fffff', returns '255, 255, 255' (no trailing comma)
function toRgbValues(hexStr: string) {
    const rgbaStr = `${parseInt(hexStr.substr(1, 2), 16)}, ${parseInt(hexStr.substr(3, 2), 16)}, ${parseInt(hexStr.substr(5, 2), 16)}`;
    return rgbaStr;
}
