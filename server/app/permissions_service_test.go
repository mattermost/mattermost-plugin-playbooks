// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

// permFakeRunService is a partial mock of PlaybookRunService for permission tests.
// Only GetPlaybookRun is overridden; all other methods panic if called.
type permFakeRunService struct {
	PlaybookRunService
	runs map[string]*PlaybookRun
}

func (f *permFakeRunService) GetPlaybookRun(id string) (*PlaybookRun, error) {
	run, ok := f.runs[id]
	if !ok {
		return nil, errors.Errorf("run %s not found", id)
	}
	return run, nil
}

func newPermSvc(api *plugintest.API, run *PlaybookRun) *PermissionsService {
	return &PermissionsService{
		pluginAPI:  pluginapi.NewClient(api, &plugintest.Driver{}),
		runService: &permFakeRunService{runs: map[string]*PlaybookRun{run.ID: run}},
	}
}

func TestRunViewDMGM(t *testing.T) {
	t.Run("DM run allows user with channel read permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID}

		api.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunView(userID, run.ID))
	})

	t.Run("DM run denies user without channel read permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID}

		api.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(false)

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunView(userID, run.ID), ErrNoPermissions)
	})

	t.Run("GM run allows user with channel read permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID, Type: RunTypeChannelChecklist}

		api.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunView(userID, run.ID))
	})

	t.Run("team-channel checklist uses channel read permission, not playbook access", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{
			ID:        model.NewId(),
			TeamID:    teamID, // non-empty: team-based channel checklist
			ChannelID: channelID,
			Type:      RunTypeChannelChecklist,
		}

		api.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunView(userID, run.ID))
	})

	t.Run("team-channel checklist denies user without channel read permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{
			ID:        model.NewId(),
			TeamID:    teamID,
			ChannelID: channelID,
			Type:      RunTypeChannelChecklist,
		}

		api.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(false)

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunView(userID, run.ID), ErrNoPermissions)
	})
}

func TestRunManagePropertiesDMGM(t *testing.T) {
	t.Run("DM run allows user with channel post permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID}

		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: 0,
		}, (*model.AppError)(nil))
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionCreatePost).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunManageProperties(userID, run.ID))
	})

	t.Run("DM run denies user without channel post permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID}

		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: 0,
		}, (*model.AppError)(nil))
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionCreatePost).Return(false)

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunManageProperties(userID, run.ID), ErrNoPermissions)
	})

	t.Run("DM run in archived channel denies all users", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID}

		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: model.GetMillis(),
		}, (*model.AppError)(nil))

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunManageProperties(userID, run.ID), ErrNoPermissions)
	})

	t.Run("team-channel checklist allows user with channel post permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{
			ID:        model.NewId(),
			TeamID:    teamID,
			ChannelID: channelID,
			Type:      RunTypeChannelChecklist,
		}

		api.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: 0,
		}, (*model.AppError)(nil))
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionCreatePost).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunManageProperties(userID, run.ID))
	})

	t.Run("team-channel checklist denies user without channel post permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{
			ID:        model.NewId(),
			TeamID:    teamID,
			ChannelID: channelID,
			Type:      RunTypeChannelChecklist,
		}

		api.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: 0,
		}, (*model.AppError)(nil))
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionCreatePost).Return(false)

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunManageProperties(userID, run.ID), ErrNoPermissions)
	})
}
