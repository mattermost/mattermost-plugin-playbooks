import {pluginId} from 'src/manifest';

// @ts-ignore
const WebappUtils = window.WebappUtils;

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
