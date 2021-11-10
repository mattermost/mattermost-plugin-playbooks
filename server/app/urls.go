package app

import "fmt"

func getRunsURL(siteURL string, manifestID string) string {
	return fmt.Sprintf(
		"%s/playbooks/runs",
		siteURL,
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
		"%s/playbooks/playbooks",
		siteURL,
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

func getRelativeRunDetailsURL(playbookRunID string) string {
	return fmt.Sprintf(
		"/playbooks/runs/%s",
		playbookRunID,
	)
}

func getRelativePlaybookDetailsURL(playbookID string) string {
	return fmt.Sprintf(
		"/playbooks/playbooks/%s",
		playbookID,
	)
}
