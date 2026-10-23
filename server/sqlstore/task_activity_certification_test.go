// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestTaskActivityCertificationEpochLifecycle(t *testing.T) {
	db := setupTestDB(t)
	store := setupSQLStore(t, db)
	ctx := context.Background()

	initial, err := store.GetTaskActivityCertification(ctx)
	require.NoError(t, err)
	require.Empty(t, initial.Epoch)
	require.False(t, initial.Enabled)
	require.Zero(t, initial.Generation)

	first, err := store.ActivateTaskActivityCertification(ctx, initial.Generation)
	require.NoError(t, err)
	require.NotEmpty(t, first.Epoch)
	require.True(t, first.Enabled)
	require.Equal(t, int64(1), first.Generation)

	_, err = store.ActivateTaskActivityCertification(ctx, first.Generation)
	require.ErrorContains(t, err, "already enabled")

	disabled, err := store.DisableTaskActivityCertification(ctx)
	require.NoError(t, err)
	require.False(t, disabled.Enabled)
	require.Equal(t, first.Epoch, disabled.Epoch)
	require.Equal(t, int64(2), disabled.Generation)

	again, err := store.DisableTaskActivityCertification(ctx)
	require.NoError(t, err)
	require.Equal(t, disabled, again)

	_, err = store.ActivateTaskActivityCertification(ctx, first.Generation)
	require.ErrorContains(t, err, "generation changed")

	second, err := store.ActivateTaskActivityCertification(ctx, disabled.Generation)
	require.NoError(t, err)
	require.NotEqual(t, first.Epoch, second.Epoch)
	require.Equal(t, int64(3), second.Generation)

	tx, err := db.Beginx()
	require.NoError(t, err)
	observed, err := store.readTaskActivityCertification(tx)
	require.NoError(t, err)
	require.Equal(t, second, observed)
	require.NoError(t, tx.Rollback())
}

func TestTaskActivityCertificationActivationWaitsForCoveredWriter(t *testing.T) {
	db := setupTestDB(t)
	store := setupSQLStore(t, db)

	writer, err := db.Beginx()
	require.NoError(t, err)
	locked, err := store.lockTaskActivityCertificationForWrite(writer)
	require.NoError(t, err)
	require.False(t, locked.Enabled)

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	_, err = store.ActivateTaskActivityCertification(ctx, locked.Generation)
	require.Error(t, err)
	require.NoError(t, writer.Rollback())

	activated, err := store.ActivateTaskActivityCertification(context.Background(), locked.Generation)
	require.NoError(t, err)
	require.True(t, activated.Enabled)
}
