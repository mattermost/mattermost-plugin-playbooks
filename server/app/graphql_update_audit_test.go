// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// graphqlUpdateAuditStore serves one run and counts GraphqlUpdate calls.
type graphqlUpdateAuditStore struct {
	PlaybookRunStore
	run     *PlaybookRun
	updated int
}

func (s *graphqlUpdateAuditStore) GetPlaybookRun(string) (*PlaybookRun, error) {
	return s.run.Clone(), nil
}

func (s *graphqlUpdateAuditStore) GraphqlUpdate(string, map[string]interface{}) error {
	s.updated++
	return nil
}

func TestGraphqlUpdateRecordsActingUser(t *testing.T) {
	const (
		runID  = "run-1"
		userID = "user-1"
	)

	store := &graphqlUpdateAuditStore{
		run: &PlaybookRun{ID: runID, Name: "Run"},
	}
	api := &stubTaskStateAPI{}
	// An empty TeamID makes the viewer broadcast channel-scoped, so only the poster is needed.
	svc := &PlaybookRunServiceImpl{
		store:          store,
		api:            api,
		poster:         &stubTaskStatePoster{},
		configService:  stubTaskStateConfig{},
		licenseChecker: stubLicenseChecker{},
	}

	err := svc.GraphqlUpdate(runID, userID, map[string]interface{}{
		"ChannelID":                 "channel-2",
		"BroadcastChannelIDs":       []string{"channel-3"},
		"WebhookOnStatusUpdateURLs": []string{"https://example.com/hook"},
	})
	require.NoError(t, err)
	require.Equal(t, 1, store.updated)

	require.Len(t, api.auditRecs, 1)
	rec := api.auditRecs[0]
	assert.Equal(t, "graphqlUpdatePlaybookRun", rec.EventName)
	assert.Equal(t, model.AuditStatusSuccess, rec.Status)
	assert.Equal(t, userID, rec.Actor.UserId)
	assert.Equal(t, userID, rec.EventData.Parameters["userID"])
	assert.Equal(t, runID, rec.EventData.Parameters["playbookRunID"])
}
