package enterprise

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type LicenseChecker struct {
	pluginAPIClient *pluginapi.Client
}

func NewLicenseChecker(pluginAPIClient *pluginapi.Client) *LicenseChecker {
	return &LicenseChecker{
		pluginAPIClient,
	}
}

// isAtLeastE10Licensed returns true when the server either has at least an E10 license or is configured for development.
func (e *LicenseChecker) isAtLeastE10Licensed() bool {
	config := e.pluginAPIClient.Configuration.GetConfig()
	license := e.pluginAPIClient.System.GetLicense()

	return pluginapi.IsE10LicensedOrDevelopment(config, license)
}

// isAtLeastE20Licensed returns true when the server either has at least an E20 license or is configured for development.
func (e *LicenseChecker) isAtLeastE20Licensed() bool {
	config := e.pluginAPIClient.Configuration.GetConfig()
	license := e.pluginAPIClient.System.GetLicense()

	return pluginapi.IsE20LicensedOrDevelopment(config, license)
}

// RetrospectiveAllowed returns true if the retrospective feature is allowed with the current license.
func (e *LicenseChecker) RetrospectiveAllowed() bool {
	return e.isAtLeastE10Licensed()
}

// TimelineAllowed returns true if the timeline feature is allowed with the current license.
func (e *LicenseChecker) TimelineAllowed() bool {
	return e.isAtLeastE10Licensed()
}

// StatsAllowed returns true if the stats feature is allowed with the current license.
func (e *LicenseChecker) StatsAllowed() bool {
	return e.isAtLeastE20Licensed()
}
