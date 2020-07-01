import {pluginId} from 'src/manifest';

// @ts-ignore
const WebappUtils = window.WebappUtils;

export const navigateToUrl = (urlPath: string) => {
    WebappUtils.browserHistory.push(urlPath);
};

export const teamPluginUrl = (teamName: string, urlPath: string) => {
    let cleanPath = urlPath;
    while (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substr(1);
    }
    return `/${teamName}/${pluginId}/` + cleanPath;
};

export const navigateToTeamPluginUrl = (teamName: string, urlPath: string) => {
    WebappUtils.browserHistory.push(teamPluginUrl(teamName, urlPath));
};
