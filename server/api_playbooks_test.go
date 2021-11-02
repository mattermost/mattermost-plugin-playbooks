package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/stretchr/testify/assert"
)

func TestPlaybooks(t *testing.T) {
	RunTest(t, func(t *testing.T, e *TestEnvironment) {
		e.CreateClients()
		e.CreateBasicServer()

		t.Run("unlicenced servers can't create a playbook with members", func(t *testing.T) {
			result, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
				Title:     "test1",
				TeamID:    e.BasicTeam.Id,
				MemberIDs: []string{e.RegularUser.Id},
			})
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
			assert.Nil(t, result)
		})

		t.Run("create playbook, unlicensed with zero pre-existing playbooks in the team, should succeed", func(t *testing.T) {
			_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
				Title:  "test1",
				TeamID: e.BasicTeam.Id,
			})
			assert.Nil(t, err)
		})

		t.Run("create playbook, unlicensed with one pre-existing playbook in the team, should fail via licencing", func(t *testing.T) {
			result, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
				Title:  "test2",
				TeamID: e.BasicTeam.Id,
			})
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
			assert.Nil(t, result)
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
			result, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
				Title:     "test3",
				TeamID:    e.BasicTeam.Id,
				MemberIDs: []string{e.RegularUser.Id},
			})
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
			assert.Nil(t, result)
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
			resultPlaybook, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
				Title:               "test5",
				TeamID:              e.BasicTeam.Id,
				BroadcastChannelIDs: []string{e.BasicPrivateChannel.Id},
			})
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
			assert.Nil(t, resultPlaybook)
		})
	})
}
