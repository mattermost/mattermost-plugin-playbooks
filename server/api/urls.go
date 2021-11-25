package api

import (
	"fmt"
	"net/url"
	"path"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

const defaultBaseAPIURL = "plugins/playbooks/api/v0"

func getAPIBaseURL(pluginAPI *pluginapi.Client) (string, error) {
	siteURL := model.ServiceSettingsDefaultSiteURL
	if pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL != nil {
		siteURL = *pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	}

	parsedSiteURL, err := url.Parse(siteURL)
	if err != nil {
		return "", errors.Wrapf(err, "failed to parse siteURL %s", siteURL)
	}

	return path.Join(parsedSiteURL.Path, defaultBaseAPIURL), nil
}

func makeAPIURL(pluginAPI *pluginapi.Client, apiPath string, args ...interface{}) string {
	apiBaseURL, err := getAPIBaseURL(pluginAPI)
	if err != nil {
		pluginAPI.Log.Warn("failed to build api base url", "err", err)
		apiBaseURL = defaultBaseAPIURL
	}

	return path.Join("/", apiBaseURL, fmt.Sprintf(apiPath, args...))
}
