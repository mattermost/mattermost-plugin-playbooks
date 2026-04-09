// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"
)

const (
	PlaybooksPath = "/playbooks/playbooks"
	RunsPath      = "/playbooks/runs"
)

// relative urls
func GetRunDetailsRelativeURL(playbookRunID string) string {
	return fmt.Sprintf("%s/%s", RunsPath, playbookRunID)
}

func GetPlaybookDetailsRelativeURL(playbookID string) string {
	return fmt.Sprintf("%s/%s", PlaybooksPath, playbookID)
}

func getChannelRelativeURL(teamName string, channelName string) string {
	return fmt.Sprintf("/%s/channels/%s", teamName, channelName)
}

func getPostRedirectRelativeURL(postID string) string {
	return fmt.Sprintf("/_redirect/pl/%s", postID)
}

func joinSiteURL(siteURL string, relativeURL string) string {
	if siteURL == "" {
		return relativeURL
	}

	return strings.TrimRight(siteURL, "/") + relativeURL
}

// absolute urls
func getRunDetailsURL(siteURL string, playbookRunID string) string {
	return joinSiteURL(siteURL, GetRunDetailsRelativeURL(playbookRunID))
}

func getRunRetrospectiveURL(siteURL string, playbookRunID string) string {
	return fmt.Sprintf("%s/retrospective", getRunDetailsURL(siteURL, playbookRunID))
}

func getPlaybooksURL(siteURL string) string {
	return joinSiteURL(siteURL, PlaybooksPath)
}

func getPlaybooksNewURL(siteURL string) string {
	return fmt.Sprintf("%s/new", getPlaybooksURL(siteURL))
}

func getPlaybookDetailsURL(siteURL string, playbookID string) string {
	return joinSiteURL(siteURL, GetPlaybookDetailsRelativeURL(playbookID))
}

func getChannelURL(siteURL string, teamName string, channelName string) string {
	return joinSiteURL(siteURL, getChannelRelativeURL(teamName, channelName))
}

func getPostRedirectURL(siteURL string, postID string) string {
	return joinSiteURL(siteURL, getPostRedirectRelativeURL(postID))
}
