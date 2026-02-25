// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

// IncomingWebhook represents an endpoint that external systems can call to
// trigger actions on playbooks or playbook runs. The webhook ID is used as
// the credential in the URL path, following the Mattermost core pattern.
type IncomingWebhook struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	CreatorID     string `json:"creator_id"`
	TeamID        string `json:"team_id"`
	PlaybookID    string `json:"playbook_id,omitempty"`
	PlaybookRunID string `json:"playbook_run_id,omitempty"`
	CreateAt      int64  `json:"create_at"`
	UpdateAt      int64  `json:"update_at"`
	DeleteAt      int64  `json:"delete_at"`
}

// PreSave sets default values for the webhook before saving.
func (w *IncomingWebhook) PreSave() {
	if w.ID == "" {
		w.ID = model.NewId()
	}
	now := model.GetMillis()
	w.CreateAt = now
	w.UpdateAt = now
}

// IsValid validates the webhook fields.
func (w *IncomingWebhook) IsValid() error {
	if w.Name == "" {
		return errors.New("name must not be empty")
	}
	if len(w.Name) > 128 {
		return errors.New("name must be 128 characters or fewer")
	}
	if w.CreatorID == "" {
		return errors.New("creator_id must not be empty")
	}
	if w.TeamID == "" {
		return errors.New("team_id must not be empty")
	}

	hasPlaybook := w.PlaybookID != ""
	hasRun := w.PlaybookRunID != ""
	if hasPlaybook && hasRun {
		return errors.New("exactly one of playbook_id or playbook_run_id must be set, not both")
	}
	if !hasPlaybook && !hasRun {
		return errors.New("exactly one of playbook_id or playbook_run_id must be set")
	}

	return nil
}

// IncomingWebhookStore defines the storage interface for incoming webhooks.
type IncomingWebhookStore interface {
	Create(webhook IncomingWebhook) (IncomingWebhook, error)
	Get(id string) (IncomingWebhook, error)
	GetByPlaybookID(playbookID string) ([]IncomingWebhook, error)
	GetByPlaybookRunID(playbookRunID string) ([]IncomingWebhook, error)
	Delete(id string) error
	DeleteByPlaybookRunID(runID string) error
}
