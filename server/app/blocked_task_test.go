// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newBlockedTaskService(t *testing.T, item ChecklistItem) taskStateService {
	t.Helper()

	h := newTaskStateService(t, item)
	return h
}

func block(h taskStateService, reason string) error {
	return h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateBlocked, 0, 0, ModifyCheckedStateOptions{BlockedReason: reason})
}

func lastEventDetails(t *testing.T, h taskStateService) TaskStateModifiedDetails {
	t.Helper()

	require.NotEmpty(t, h.store.events)
	var details TaskStateModifiedDetails
	require.NoError(t, json.Unmarshal([]byte(h.store.events[len(h.store.events)-1].Details), &details))
	return details
}

func TestBlockChecklistItem(t *testing.T) {
	t.Run("blocking a started task keeps the reason on the task, the log and the timeline", func(t *testing.T) {
		h := newBlockedTaskService(t, itemWithState("item1", ChecklistItemStateInProgress))

		require.NoError(t, block(h, "  Waiting on identity team approval  "))

		item := h.store.item()
		assert.Equal(t, ChecklistItemStateBlocked, item.State)
		assert.Equal(t, "Waiting on identity team approval", item.BlockedReason)

		require.Len(t, h.store.stateChanges, 1)
		assert.Equal(t, ChecklistItemStateInProgress, h.store.stateChanges[0].FromState)
		assert.Equal(t, "Waiting on identity team approval", h.store.stateChanges[0].BlockedReason)

		details := lastEventDetails(t, h)
		assert.Equal(t, taskStateActionBlock, details.Action)
		assert.Equal(t, "Waiting on identity team approval", details.BlockedReason)
		assert.Equal(t, "blocked checklist item **Deploy the thing**", h.store.events[0].Summary)
	})

	t.Run("an open task can be blocked", func(t *testing.T) {
		h := newBlockedTaskService(t, openItem())

		require.NoError(t, block(h, "Waiting on vendor"))

		assert.Equal(t, ChecklistItemStateBlocked, h.store.item().State)
	})

	t.Run("rejected", func(t *testing.T) {
		for name, tc := range map[string]struct {
			state  string
			reason string
		}{
			"without a reason":         {state: ChecklistItemStateOpen, reason: "   "},
			"with an overlong reason":  {state: ChecklistItemStateOpen, reason: strings.Repeat("a", MaxBlockedReasonLength+1)},
			"when the task is done":    {state: ChecklistItemStateClosed, reason: "reason"},
			"when the task is skipped": {state: ChecklistItemStateSkipped, reason: "reason"},
		} {
			t.Run(name, func(t *testing.T) {
				h := newTaskStateService(t, itemWithState("item1", tc.state))

				err := block(h, tc.reason)

				require.Error(t, err)
				assert.True(t, errors.Is(err, ErrMalformedPlaybookRun), "the API maps this to a 400")
				assert.Equal(t, tc.state, h.store.item().State)
				assert.Zero(t, h.store.updates)
				assert.Empty(t, h.store.stateChanges)
			})
		}
	})
}

func TestLeavingBlockedState(t *testing.T) {
	blockedItem := func() ChecklistItem {
		item := itemWithState("item1", ChecklistItemStateBlocked)
		item.BlockedReason = "Waiting on vendor"
		return item
	}

	t.Run("unblocking returns the task to started and clears the reason", func(t *testing.T) {
		h := newBlockedTaskService(t, blockedItem())

		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateInProgress, 0, 0))

		item := h.store.item()
		assert.Equal(t, ChecklistItemStateInProgress, item.State)
		assert.Empty(t, item.BlockedReason)
		assert.Equal(t, taskStateActionUnblock, lastEventDetails(t, h).Action)
		require.Len(t, h.store.stateChanges, 1)
		assert.Equal(t, ChecklistItemStateBlocked, h.store.stateChanges[0].FromState)
		assert.Empty(t, h.store.stateChanges[0].BlockedReason)
	})

	t.Run("a blocked task can be finished directly", func(t *testing.T) {
		h := newBlockedTaskService(t, blockedItem())

		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateClosed, 0, 0))

		assert.Equal(t, ChecklistItemStateClosed, h.store.item().State)
		assert.Empty(t, h.store.item().BlockedReason)
		assert.Equal(t, taskStateActionCheck, lastEventDetails(t, h).Action)
	})

	t.Run("skipping a blocked task clears the reason", func(t *testing.T) {
		h := newBlockedTaskService(t, blockedItem())

		require.NoError(t, h.svc.SkipChecklistItem("run1", "user1", 0, 0))

		assert.Empty(t, h.store.item().BlockedReason)
	})

	t.Run("unblocking clears who the task was blocked by", func(t *testing.T) {
		item := blockedItem()
		item.BlockedByUserIDs = []string{"member1"}
		h := newTaskStateService(t, item)

		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateInProgress, 0, 0))

		assert.Empty(t, h.store.item().BlockedByUserIDs)
	})
}

func TestStartingATaskIsRecordedAsStart(t *testing.T) {
	h := newTaskStateService(t, openItem())

	require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateInProgress, 0, 0))

	assert.Equal(t, taskStateActionStart, lastEventDetails(t, h).Action, "starting a task is not checking it off")
	assert.Equal(t, "started checklist item **Deploy the thing**", h.store.events[0].Summary)
}

func TestCountOutstandingChecklistItemsIncludesBlocked(t *testing.T) {
	checklists := []Checklist{{Items: []ChecklistItem{
		{State: ChecklistItemStateBlocked},
		{State: ChecklistItemStateInProgress},
		{State: ChecklistItemStateClosed},
	}}}

	assert.Equal(t, 2, CountOutstandingChecklistItemsForFinishRun(checklists))
}

type blockedByAPI struct {
	stubTaskStateAPI
	users   map[string]*model.User
	members map[string]bool
}

func (a *blockedByAPI) GetUser(userID string) (*model.User, *model.AppError) {
	if user, ok := a.users[userID]; ok {
		return user, nil
	}
	return nil, model.NewAppError("GetUser", "not_found", nil, "", 404)
}

func (a *blockedByAPI) GetChannelMember(_, userID string) (*model.ChannelMember, *model.AppError) {
	if a.members[userID] {
		return &model.ChannelMember{UserId: userID}, nil
	}
	return nil, model.NewAppError("GetChannelMember", "not_found", nil, "", 404)
}

func (a *blockedByAPI) GetConfig() *model.Config {
	return &model.Config{ServiceSettings: model.ServiceSettings{SiteURL: model.NewPointer("https://mm.example.com")}}
}

type blockedByPoster struct {
	stubTaskStatePoster
	posts []*model.Post
	dms   map[string]*model.Post
}

func (p *blockedByPoster) Post(post *model.Post) error {
	p.posts = append(p.posts, post)
	return nil
}

func (p *blockedByPoster) DM(userID string, post *model.Post) error {
	p.dms[userID] = post
	return nil
}

func newBlockedByService(t *testing.T) (taskStateService, *blockedByPoster) {
	t.Helper()

	h := newTaskStateService(t, itemWithState("item1", ChecklistItemStateInProgress))
	api := &blockedByAPI{
		users: map[string]*model.User{
			"user1":    {Id: "user1", Username: "actor"},
			"member1":  {Id: "member1", Username: "alice"},
			"outsider": {Id: "outsider", Username: "bob"},
			"bot1":     {Id: "bot1", Username: "bot", IsBot: true},
			"gone":     {Id: "gone", Username: "gone", DeleteAt: 1},
		},
		members: map[string]bool{"user1": true, "member1": true},
	}
	poster := &blockedByPoster{dms: map[string]*model.Post{}}
	h.svc.api = api
	h.svc.pluginAPI = pluginapi.NewClient(api, nil)
	h.svc.poster = poster
	h.store.run.Name = "Database outage"
	return h, poster
}

func blockBy(h taskStateService, userIDs ...string) error {
	return h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateBlocked, 0, 0, ModifyCheckedStateOptions{BlockedReason: "Waiting on @channel access", BlockedByUserIDs: userIDs})
}

func TestBlockedBy(t *testing.T) {
	t.Run("records who the task is blocked by on the task, the log and the timeline", func(t *testing.T) {
		h, _ := newBlockedByService(t)

		require.NoError(t, blockBy(h, "member1", "outsider", "member1"))

		assert.Equal(t, []string{"member1", "outsider"}, h.store.item().BlockedByUserIDs)
		require.Len(t, h.store.stateChanges, 1)
		assert.Equal(t, []string{"member1", "outsider"}, h.store.stateChanges[0].BlockedByUserIDs)
		assert.Equal(t, []string{"member1", "outsider"}, lastEventDetails(t, h).BlockedByUserIDs)
	})

	t.Run("mentions channel members in the run channel without channel-wide mentions", func(t *testing.T) {
		h, poster := newBlockedByService(t)

		require.NoError(t, blockBy(h, "member1"))

		require.Len(t, poster.posts, 1)
		assert.Equal(t, "channel1", poster.posts[0].ChannelId)
		assert.Contains(t, poster.posts[0].Message, "@alice")
		assert.Equal(t, true, poster.posts[0].GetProp(model.PostPropsMentionHighlightDisabled))
		assert.Empty(t, poster.dms)
	})

	t.Run("DMs users outside the channel a link to the run", func(t *testing.T) {
		h, poster := newBlockedByService(t)

		require.NoError(t, blockBy(h, "outsider"))

		assert.Empty(t, poster.posts)
		require.Contains(t, poster.dms, "outsider")
		assert.Contains(t, poster.dms["outsider"].Message, "[Database outage](https://mm.example.com/playbooks/runs/run1")
	})

	t.Run("does not notify the person blocking the task", func(t *testing.T) {
		h, poster := newBlockedByService(t)

		require.NoError(t, blockBy(h, "user1"))

		assert.Empty(t, poster.posts)
		assert.Empty(t, poster.dms)
	})

	t.Run("rejected", func(t *testing.T) {
		tooMany := make([]string, MaxBlockedByUsers+1)
		for i := range tooMany {
			tooMany[i] = model.NewId()
		}
		for name, userIDs := range map[string][]string{
			"for an unknown user": {"missing"},
			"for a bot":           {"bot1"},
			"for a deleted user":  {"gone"},
			"for too many users":  tooMany,
		} {
			t.Run(name, func(t *testing.T) {
				h, poster := newBlockedByService(t)

				err := blockBy(h, userIDs...)

				require.Error(t, err)
				assert.True(t, errors.Is(err, ErrMalformedPlaybookRun))
				assert.Equal(t, ChecklistItemStateInProgress, h.store.item().State)
				assert.Empty(t, poster.posts)
				assert.Empty(t, poster.dms)
			})
		}
	})
}

var _ plugin.API = (*blockedByAPI)(nil)
