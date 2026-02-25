// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type incomingWebhookStore struct {
	store                 *SQLStore
	incomingWebhookSelect sq.SelectBuilder
}

var _ app.IncomingWebhookStore = (*incomingWebhookStore)(nil)

func NewIncomingWebhookStore(sqlStore *SQLStore) app.IncomingWebhookStore {
	incomingWebhookSelect := sqlStore.builder.
		Select(
			"ID",
			"Name",
			"CreatorID",
			"TeamID",
			"PlaybookID",
			"PlaybookRunID",
			"CreateAt",
			"UpdateAt",
			"DeleteAt",
		).
		From("IR_IncomingWebhook")

	return &incomingWebhookStore{
		store:                 sqlStore,
		incomingWebhookSelect: incomingWebhookSelect,
	}
}

func (s *incomingWebhookStore) Create(webhook app.IncomingWebhook) (app.IncomingWebhook, error) {
	webhook.PreSave()

	if err := webhook.IsValid(); err != nil {
		return app.IncomingWebhook{}, errors.Wrap(err, "incoming webhook is not valid")
	}

	_, err := s.store.execBuilder(s.store.db, sq.
		Insert("IR_IncomingWebhook").
		SetMap(map[string]any{
			"ID":            webhook.ID,
			"Name":          webhook.Name,
			"CreatorID":     webhook.CreatorID,
			"TeamID":        webhook.TeamID,
			"PlaybookID":    webhook.PlaybookID,
			"PlaybookRunID": webhook.PlaybookRunID,
			"CreateAt":      webhook.CreateAt,
			"UpdateAt":      webhook.UpdateAt,
			"DeleteAt":      0,
		}))
	if err != nil {
		return app.IncomingWebhook{}, errors.Wrap(err, "failed to store new incoming webhook")
	}

	return webhook, nil
}

func (s *incomingWebhookStore) Get(id string) (app.IncomingWebhook, error) {
	var webhook app.IncomingWebhook
	err := s.store.getBuilder(s.store.db, &webhook,
		s.incomingWebhookSelect.Where(sq.Eq{"ID": id, "DeleteAt": 0}))
	if err == sql.ErrNoRows {
		return app.IncomingWebhook{}, errors.Wrapf(app.ErrNotFound, "incoming webhook does not exist for id '%s'", id)
	} else if err != nil {
		return app.IncomingWebhook{}, errors.Wrapf(err, "failed to get incoming webhook by id '%s'", id)
	}

	return webhook, nil
}

func (s *incomingWebhookStore) GetByPlaybookID(playbookID string) ([]app.IncomingWebhook, error) {
	var webhooks []app.IncomingWebhook
	err := s.store.selectBuilder(s.store.db, &webhooks,
		s.incomingWebhookSelect.
			Where(sq.Eq{"PlaybookID": playbookID, "DeleteAt": 0}))
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get incoming webhooks for playbook '%s'", playbookID)
	}

	return webhooks, nil
}

func (s *incomingWebhookStore) GetByPlaybookRunID(playbookRunID string) ([]app.IncomingWebhook, error) {
	var webhooks []app.IncomingWebhook
	err := s.store.selectBuilder(s.store.db, &webhooks,
		s.incomingWebhookSelect.
			Where(sq.Eq{"PlaybookRunID": playbookRunID, "DeleteAt": 0}))
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get incoming webhooks for playbook run '%s'", playbookRunID)
	}

	return webhooks, nil
}

func (s *incomingWebhookStore) Delete(id string) error {
	_, err := s.store.execBuilder(s.store.db, sq.
		Update("IR_IncomingWebhook").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"ID": id, "DeleteAt": 0}))
	if err != nil {
		return errors.Wrapf(err, "failed to delete incoming webhook with id '%s'", id)
	}

	return nil
}

func (s *incomingWebhookStore) DeleteByPlaybookRunID(runID string) error {
	_, err := s.store.execBuilder(s.store.db, sq.
		Update("IR_IncomingWebhook").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"PlaybookRunID": runID, "DeleteAt": 0}))
	if err != nil {
		return errors.Wrapf(err, "failed to delete incoming webhooks for playbook run '%s'", runID)
	}

	return nil
}
