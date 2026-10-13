// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// AutomationAPIUser lets the plugin attach the API used to emit signals.
// Unit tests leave it unset.
type AutomationAPIUser interface {
	UseAutomationAPI(api plugin.API)
}

func (s *PlaybookRunServiceImpl) UseAutomationAPI(api plugin.API) {
	s.signalAPI = api
}

func (s *playbookService) UseAutomationAPI(api plugin.API) {
	s.signalAPI = api
}

func (s *PlaybookRunServiceImpl) emitRunSignal(name, runID string, extra map[string]string) {
	if s == nil || s.signalAPI == nil || runID == "" || name == "" {
		return
	}
	run, err := s.store.GetPlaybookRun(runID)
	if err != nil || run == nil {
		logrus.WithError(err).WithField("signal", name).Warn("automation signal skipped; run was not loaded")
		return
	}
	payload := map[string]string{
		"run_id":      run.ID,
		"playbook_id": run.PlaybookID,
		"team_id":     run.TeamID,
		"channel_id":  run.ChannelID,
	}
	if run.PostID != "" && name == "run_created" {
		payload["post_id"] = run.PostID
	}
	for key, value := range extra {
		if value != "" {
			payload[key] = value
		}
	}
	if err := s.signalAPI.EmitAutomationSignal(name, automationTextPayload(payload), ""); err != nil {
		logrus.WithError(err).WithField("signal", name).Warn("automation signal was not emitted")
	}
}

func (s *playbookService) emitPlaybookSignal(name string, playbook Playbook, userID string) {
	if s == nil || s.signalAPI == nil || playbook.ID == "" {
		return
	}
	if err := s.signalAPI.EmitAutomationSignal(name, automationTextPayload(map[string]string{
		"playbook_id": playbook.ID,
		"team_id":     playbook.TeamID,
		"user_id":     userID,
	}), ""); err != nil {
		logrus.WithError(err).WithField("signal", name).Warn("automation signal was not emitted")
	}
}

func automationTextPayload(values map[string]string) map[string]model.AutomationValue {
	out := make(map[string]model.AutomationValue, len(values))
	for key, value := range values {
		if value != "" {
			out[key] = model.AutomationText(value)
		}
	}
	return out
}
