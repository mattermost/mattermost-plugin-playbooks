package app

import "fmt"

const (
	PlaybooksPath = "/playbooks/playbooks"
	RunsPath      = "/playbooks/runs"
)

func getRunDetailsRelativeURL(playbookRunID string) string {
	return fmt.Sprintf("%s/%s", RunsPath, playbookRunID)
}

func getPlaybookDetailsRelativeURL(playbookID string) string {
	return fmt.Sprintf("%s/%s", PlaybooksPath, playbookID)
}

func getRunDetailsURL(siteURL string, playbookRunID string) string {
	return fmt.Sprintf("%s%s", siteURL, getRunDetailsRelativeURL(playbookRunID))
}

func getRunRetrospectiveURL(siteURL string, playbookRunID string) string {
	return fmt.Sprintf("%s/retrospective", getRunDetailsURL(siteURL, playbookRunID))
}

func getPlaybooksURL(siteURL string) string {
	return fmt.Sprintf("%s%s", siteURL, PlaybooksPath)
}

func getPlaybooksNewURL(siteURL string) string {
	return fmt.Sprintf("%s/new", getPlaybooksURL(siteURL))
}

func getPlaybookDetailsURL(siteURL string, playbookID string) string {
	return fmt.Sprintf("%s%s", siteURL, getPlaybookDetailsRelativeURL(playbookID))
}
