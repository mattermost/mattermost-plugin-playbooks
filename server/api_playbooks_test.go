package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/stretchr/testify/assert"
)

func TestPlaybooks(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()

	t.Run("unlicenced servers can't create a playbook with members", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:     "test1",
			TeamID:    e.BasicTeam.Id,
			MemberIDs: []string{e.RegularUser.Id},
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, id)
	})

	t.Run("create playbook, unlicensed with zero pre-existing playbooks in the team, should succeed", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test1",
			TeamID: e.BasicTeam.Id,
		})
		assert.Nil(t, err)
	})

	t.Run("create playbook, unlicensed with one pre-existing playbook in the team, should fail via licencing", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test2",
			TeamID: e.BasicTeam.Id,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, id)
	})

	e.SetE10Licence()

	t.Run("create playbook, e10 licenced with one pre-existing playbook in the team, should now succeed", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test2",
			TeamID: e.BasicTeam.Id,
		})
		assert.Nil(t, err)
	})

	t.Run("e10 licenced servers can't create a playbook with members", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:     "test3",
			TeamID:    e.BasicTeam.Id,
			MemberIDs: []string{e.RegularUser.Id},
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, id)
	})

	e.SetE20Licence()

	t.Run("e20 licenced servers can create a playbooks with members", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:     "test4",
			TeamID:    e.BasicTeam.Id,
			MemberIDs: []string{e.RegularUser.Id},
		})
		assert.Nil(t, err)
	})

	t.Run("create playbook with no permissions to broadcast channel", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:               "test5",
			TeamID:              e.BasicTeam.Id,
			BroadcastChannelIDs: []string{e.BasicPrivateChannel.Id},
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, id)
	})

	t.Run("archived playbooks cannot be updated or used to create new runs", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:     "test6 - to be archived",
			TeamID:    e.BasicTeam.Id,
			MemberIDs: []string{e.RegularUser.Id},
		})
		assert.Nil(t, err)

		playbook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), id)
		assert.Nil(t, err)

		// Make sure we /can/ update
		playbook.Title = "New Title!"
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *playbook)
		assert.Nil(t, err)

		err = e.PlaybooksClient.Playbooks.Archive(context.Background(), id)
		assert.Nil(t, err)

		// Test that we cannot update an archived playbook
		playbook.Title = "Another title"
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *playbook)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)

		// Test that we cannot use an archived playbook to start a new run
		_, err = e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  id,
		})
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
	})

	t.Run("playbooks can be searched by title", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 1 -- all access",
			TeamID: e.BasicTeam.Id,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		id, err = e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:     "SearchTest 2 -- only regular user access",
			TeamID:    e.BasicTeam.Id,
			MemberIDs: []string{e.RegularUser.Id},
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		id, err = e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 3 -- strange string: hümberdångle",
			TeamID: e.BasicTeam.Id,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		id, err = e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 4 -- team 2 string: よこそ",
			TeamID: e.BasicTeam2.Id,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		playbookResults, err := e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "SearchTest",
		})
		assert.Nil(t, err)
		assert.Equal(t, 4, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "SearchTest 2",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "ümber",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "よこそ",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient2.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "SearchTest",
		})
		assert.Nil(t, err)
		assert.Equal(t, 2, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient2.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "ümberdå",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)
	})
}
