// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"

	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

type TaskActivityCertification struct {
	Epoch      string `db:"epoch"`
	Enabled    bool   `db:"enabled"`
	Generation int64  `db:"generation"`
}

func (s *SQLStore) GetTaskActivityCertification(ctx context.Context) (TaskActivityCertification, error) {
	var certification TaskActivityCertification
	err := s.db.GetContext(ctx, &certification, `SELECT Epoch, Enabled, Generation FROM IR_TaskActivityCertification WHERE ID = 1`)
	return certification, errors.Wrap(err, "could not read task activity certification")
}

func (s *SQLStore) readTaskActivityCertification(tx *sqlx.Tx) (TaskActivityCertification, error) {
	var certification TaskActivityCertification
	err := tx.Get(&certification, `SELECT Epoch, Enabled, Generation FROM IR_TaskActivityCertification WHERE ID = 1`)
	return certification, errors.Wrap(err, "could not read task activity certification in transaction")
}

// Covered writers lock this row before the run row so activation can fence them across plugin nodes.
func (s *SQLStore) lockTaskActivityCertificationForWrite(tx *sqlx.Tx) (TaskActivityCertification, error) {
	var certification TaskActivityCertification
	err := tx.Get(&certification, `SELECT Epoch, Enabled, Generation FROM IR_TaskActivityCertification WHERE ID = 1 FOR SHARE`)
	return certification, errors.Wrap(err, "could not lock task activity certification for write")
}

// ActivateTaskActivityCertification requires an external cluster-wide writer fence and a completed
// audit of every covered writer. A new epoch is mandatory after any interval of uncertified writes.
func (s *SQLStore) ActivateTaskActivityCertification(ctx context.Context, expectedGeneration int64) (TaskActivityCertification, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return TaskActivityCertification{}, errors.Wrap(err, "could not begin task activity activation")
	}
	defer s.finalizeTransaction(tx)

	var certification TaskActivityCertification
	if err := tx.GetContext(ctx, &certification, `SELECT Epoch, Enabled, Generation FROM IR_TaskActivityCertification WHERE ID = 1 FOR UPDATE`); err != nil {
		return TaskActivityCertification{}, errors.Wrap(err, "could not lock task activity certification for activation")
	}
	if certification.Enabled || certification.Generation != expectedGeneration {
		return TaskActivityCertification{}, errors.New("task activity certification generation changed or is already enabled")
	}

	newEpoch := model.NewId()
	for newEpoch == certification.Epoch {
		newEpoch = model.NewId()
	}
	certification.Epoch = newEpoch
	certification.Enabled = true
	certification.Generation++
	if _, err := tx.ExecContext(ctx, `UPDATE IR_TaskActivityCertification SET Epoch = $1, Enabled = TRUE, Generation = $2 WHERE ID = 1`, certification.Epoch, certification.Generation); err != nil {
		return TaskActivityCertification{}, errors.Wrap(err, "could not activate task activity certification")
	}
	if err := tx.Commit(); err != nil {
		return TaskActivityCertification{}, errors.Wrap(err, "could not commit task activity activation")
	}
	return certification, nil
}

func (s *SQLStore) DisableTaskActivityCertification(ctx context.Context) (TaskActivityCertification, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return TaskActivityCertification{}, errors.Wrap(err, "could not begin task activity disable")
	}
	defer s.finalizeTransaction(tx)

	var certification TaskActivityCertification
	if err := tx.GetContext(ctx, &certification, `SELECT Epoch, Enabled, Generation FROM IR_TaskActivityCertification WHERE ID = 1 FOR UPDATE`); err != nil {
		return TaskActivityCertification{}, errors.Wrap(err, "could not lock task activity certification for disable")
	}
	if certification.Enabled {
		certification.Enabled = false
		certification.Generation++
		if _, err := tx.ExecContext(ctx, `UPDATE IR_TaskActivityCertification SET Enabled = FALSE, Generation = $1 WHERE ID = 1`, certification.Generation); err != nil {
			return TaskActivityCertification{}, errors.Wrap(err, "could not disable task activity certification")
		}
	}
	if err := tx.Commit(); err != nil {
		return TaskActivityCertification{}, errors.Wrap(err, "could not commit task activity disable")
	}
	return certification, nil
}
