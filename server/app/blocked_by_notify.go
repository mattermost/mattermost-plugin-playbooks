// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/sirupsen/logrus"
	stripmd "github.com/writeas/go-strip-markdown"
)

// MaxBlockedByUsers bounds how many users a task can be blocked by.
const MaxBlockedByUsers = 10

// notifyBlockedBy tells each user a task is blocked on. Channel members are mentioned in the run
// channel; everyone else gets a DM linking to the run.
func (s *PlaybookRunServiceImpl) notifyBlockedBy(run *PlaybookRun, actorID string, item ChecklistItem) {
	if len(item.BlockedByUserIDs) == 0 {
		return
	}
	logger := logrus.WithFields(logrus.Fields{"playbook_run_id": run.ID, "item_id": item.ID})

	actorName := actorID
	if actor, err := s.pluginAPI.User.Get(actorID); err == nil {
		actorName = "@" + actor.Username
	}

	task := stripmd.Strip(item.Title)
	reason := quoteMarkdown(item.BlockedReason)

	var mentions []string
	for _, userID := range item.BlockedByUserIDs {
		if userID == actorID {
			continue
		}
		user, err := s.pluginAPI.User.Get(userID)
		if err != nil {
			logger.WithError(err).WithField("user_id", userID).Warn("failed to get user blocking a task")
			continue
		}

		if _, err := s.pluginAPI.Channel.GetMember(run.ChannelID, userID); err == nil {
			mentions = append(mentions, "@"+user.Username)
			continue
		}

		message := fmt.Sprintf("%s marked **%s** in [%s](%s) as blocked on you.\n%s", actorName, task, run.Name, s.runURL(run.ID), reason)
		if err := s.poster.DM(userID, &model.Post{Message: message}); err != nil {
			logger.WithError(err).WithField("user_id", userID).Warn("failed to DM user blocking a task")
		}
	}

	if len(mentions) == 0 {
		return
	}
	post := &model.Post{
		ChannelId: run.ChannelID,
		Message:   fmt.Sprintf("%s: %s marked **%s** as blocked on you.\n%s", strings.Join(mentions, ", "), actorName, task, reason),
	}
	// The task title and reason are user input, so they must not trigger @channel or @here.
	post.AddProp(model.PostPropsMentionHighlightDisabled, true)
	if err := s.poster.Post(post); err != nil {
		logger.WithError(err).Warn("failed to post blocked task notification")
	}
}

func (s *PlaybookRunServiceImpl) runURL(playbookRunID string) string {
	siteURL := ""
	if config := s.pluginAPI.Configuration.GetConfig(); config != nil && config.ServiceSettings.SiteURL != nil {
		siteURL = *config.ServiceSettings.SiteURL
	}
	return getRunDetailsURL(siteURL, playbookRunID)
}

func quoteMarkdown(text string) string {
	return "> " + strings.ReplaceAll(text, "\n", "\n> ")
}
