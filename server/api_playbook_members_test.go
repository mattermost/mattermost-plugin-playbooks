// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPlaybookMembersREST(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Private playbook: RegularUser is a member; RegularUser2 is not.
	playbookID := e.BasicPrivatePlaybook.ID

	hasMember := func(t *testing.T, playbookID, userID string) bool {
		t.Helper()
		pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
		require.NoError(t, err)
		for _, m := range pb.Members {
			if m.UserID == userID {
				return true
			}
		}
		return false
	}

	t.Run("member with manage permission can add and remove", func(t *testing.T) {
		require.False(t, hasMember(t, playbookID, e.RegularUser2.Id))

		// Default playbook_member role includes manage-members, matching GraphQL.
		err := e.PlaybooksClient.Playbooks.AddMember(context.Background(), playbookID, e.RegularUser2.Id)
		require.NoError(t, err)
		require.True(t, hasMember(t, playbookID, e.RegularUser2.Id))

		err = e.PlaybooksClient.Playbooks.RemoveMember(context.Background(), playbookID, e.RegularUser2.Id)
		require.NoError(t, err)
		require.False(t, hasMember(t, playbookID, e.RegularUser2.Id))
	})

	t.Run("member can leave without needing to manage others", func(t *testing.T) {
		err := e.PlaybooksAdminClient.Playbooks.AddMember(context.Background(), playbookID, e.RegularUser2.Id)
		require.NoError(t, err)
		require.True(t, hasMember(t, playbookID, e.RegularUser2.Id))

		err = e.PlaybooksClient2.Playbooks.RemoveMember(context.Background(), playbookID, e.RegularUser2.Id)
		require.NoError(t, err)
		require.False(t, hasMember(t, playbookID, e.RegularUser2.Id))
	})

	t.Run("non-member cannot add", func(t *testing.T) {
		err := e.PlaybooksClient2.Playbooks.AddMember(context.Background(), playbookID, e.RegularUser2.Id)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("non-member cannot remove another member", func(t *testing.T) {
		err := e.PlaybooksClient2.Playbooks.RemoveMember(context.Background(), playbookID, e.RegularUser.Id)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("private playbook without access is rejected", func(t *testing.T) {
		err := e.PlaybooksClient.Playbooks.AddMember(context.Background(), e.PrivatePlaybookNoMembers.ID, e.RegularUser.Id)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})
}
