package app

import "fmt"

const pluginRoute = "plug"

func getRunsURL(siteURL string, manifestID string) string {
	return fmt.Sprintf(
		"%s/%s/%s/runs",
		siteURL,
		pluginRoute,
		manifestID,
	)
}

func getRunDetailsURL(siteURL string, manifestID string, playbookRunID string) string {
	return fmt.Sprintf(
		"%s/%s",
		getRunsURL(siteURL, manifestID),
		playbookRunID,
	)
}

func getRunRetrospectiveURL(siteURL string, manifestID string, playbookRunID string) string {
	return fmt.Sprintf("%s/retrospective", getRunDetailsURL(siteURL, manifestID, playbookRunID))
}

func getPlaybooksURL(siteURL string, manifestID string) string {
	return fmt.Sprintf(
		"%s/%s/%s/playbooks",
		siteURL,
		pluginRoute,
		manifestID,
	)
}

func getPlaybooksNewURL(siteURL string, manifestID string) string {
	return fmt.Sprintf("%s/new", getPlaybooksURL(siteURL, manifestID))
}

func getPlaybookDetailsURL(siteURL string, manifestID string, playbookID string) string {
	return fmt.Sprintf(
		"%s/%s",
		getPlaybooksURL(siteURL, manifestID),
		playbookID,
	)
}
