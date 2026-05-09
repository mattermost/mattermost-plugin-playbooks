// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
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

// getChannelRelativeURL returns /<teamName>/channels/<channelSlug>.
// channelSlug is the channel name (public/private channels only).
// For DM/GM links use getRelativeURLForChannel instead.
func getChannelRelativeURL(teamName string, channelSlug string) string {
	return fmt.Sprintf("/%s/channels/%s", teamName, channelSlug)
}

// getRelativeURLForChannel returns the relative URL for any channel type:
//   - public/private: /<team>/channels/<channel.Name>
//   - GM:             /<team>/messages/<channel.Name>
//   - DM:             /<team>/messages/<channel.Id>  (ID used for stable markdown references;
//     prefer /<team>/messages/@<username> in the frontend when both users are known)
func getRelativeURLForChannel(teamName string, channel *model.Channel) string {
	switch channel.Type {
	case model.ChannelTypeDirect:
		return fmt.Sprintf("/%s/messages/%s", teamName, channel.Id)
	case model.ChannelTypeGroup:
		return fmt.Sprintf("/%s/messages/%s", teamName, channel.Name)
	default:
		return getChannelRelativeURL(teamName, channel.Name)
	}
}

// absolute urls

func getRunDetailsURL(siteURL string, playbookRunID string) string {
	return fmt.Sprintf("%s%s", siteURL, GetRunDetailsRelativeURL(playbookRunID))
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
	return fmt.Sprintf("%s%s", siteURL, GetPlaybookDetailsRelativeURL(playbookID))
}

// getChannelURL returns <siteURL>/<teamName>/channels/<channelSlug>.
// channelSlug is the channel name (public/private channels only).
// For DM/GM links use getURLForChannel instead.
func getChannelURL(siteURL string, teamName string, channelSlug string) string {
	return fmt.Sprintf("%s/%s/channels/%s", siteURL, teamName, channelSlug)
}

// getURLForChannel returns the absolute URL for any channel type.
// See getRelativeURLForChannel for the path format per channel type.
func getURLForChannel(siteURL string, teamName string, channel *model.Channel) string {
	switch channel.Type {
	case model.ChannelTypeDirect:
		return fmt.Sprintf("%s/%s/messages/%s", siteURL, teamName, channel.Id)
	case model.ChannelTypeGroup:
		return fmt.Sprintf("%s/%s/messages/%s", siteURL, teamName, channel.Name)
	default:
		return getChannelURL(siteURL, teamName, channel.Name)
	}
}
