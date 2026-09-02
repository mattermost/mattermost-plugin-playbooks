// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
)

const (
	wsTeamID        = "team-ws"
	wsChannelID     = "channel-ws"
	wsPlaybookID    = "playbook-ws"
	wsRunID         = "run-ws"
	wsOwnerID       = "u-owner"
	wsParticipantID = "u-participant"
	wsPBMemberID    = "u-playbook-member"
	wsGuestID       = "u-guest"
	wsStrangerID    = "u-stranger"
)

// runWSFixture wires a PlaybookRunServiceImpl with the dependencies needed to observe
// websocket fan-out: a poster that records who it published to, a configurable channel
// membership, and a real PermissionsService over a stubbed playbook.
type runWSFixture struct {
	api              *plugintest.API
	playbooks        *stubPlaybookService
	svc              *PlaybookRunServiceImpl
	usersNotified    []string
	channelBroadcast []string
}

func newRunWSFixture(t *testing.T, playbook Playbook, playbookErr error) *runWSFixture {
	t.Helper()

	api := &plugintest.API{}
	poster := mock_bot.NewMockPoster(gomock.NewController(t))
	f := &runWSFixture{
		api:       api,
		playbooks: &stubPlaybookService{playbook: playbook, err: playbookErr},
	}

	poster.EXPECT().
		PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any()).
		Do(func(_ string, _ interface{}, userID string) {
			f.usersNotified = append(f.usersNotified, userID)
		}).
		AnyTimes()
	poster.EXPECT().
		PublishWebsocketEventToChannel(gomock.Any(), gomock.Any(), gomock.Any()).
		Do(func(_ string, _ interface{}, channelID string) {
			f.channelBroadcast = append(f.channelBroadcast, channelID)
		}).
		AnyTimes()

	client := pluginapi.NewClient(api, nil)
	f.svc = &PlaybookRunServiceImpl{
		pluginAPI: client,
		poster:    poster,
		permissions: &PermissionsService{
			playbookService: f.playbooks,
			pluginAPI:       client,
			licenseChecker:  allowAllLicenseChecker{},
		},
	}

	t.Cleanup(func() { api.AssertExpectations(t) })

	return f
}

// setChannelMembers makes userIDs the members of the run's channel.
func (f *runWSFixture) setChannelMembers(userIDs ...string) {
	members := make(model.ChannelMembers, 0, len(userIDs))
	for _, userID := range userIDs {
		members = append(members, model.ChannelMember{ChannelId: wsChannelID, UserId: userID})
	}

	f.api.On("GetChannelMembers", wsChannelID, 0, runAudiencePerPage).Return(members, nil).Maybe()
	f.api.On("GetChannelMembers", wsChannelID, mock.Anything, runAudiencePerPage).
		Return(model.ChannelMembers{}, nil).Maybe()
}

// failChannelMembers makes listing the run channel's members fail.
func (f *runWSFixture) failChannelMembers() {
	f.api.On("GetChannelMembers", wsChannelID, mock.Anything, mock.Anything).
		Return(nil, model.NewAppError("GetChannelMembers", "app.channel.get_members.app_error", nil, "", 500)).Maybe()
}

// allowTeamView grants userIDs team view access and denies every other team permission, so
// only an explicit playbook role can grant access to a private playbook.
func (f *runWSFixture) allowTeamView(userIDs ...string) {
	for _, userID := range userIDs {
		f.api.On("HasPermissionToTeam", userID, wsTeamID, model.PermissionViewTeam).Return(true).Maybe()
	}
	f.api.On("HasPermissionToTeam", mock.Anything, wsTeamID, mock.Anything).Return(false).Maybe()
}

// grantPlaybookMemberView lets the playbook member role view a private playbook.
func (f *runWSFixture) grantPlaybookMemberView() {
	f.api.On("RolesGrantPermission", []string{PlaybookRoleMember}, model.PermissionPrivatePlaybookView.Id).
		Return(true).Maybe()
	f.api.On("RolesGrantPermission", mock.Anything, mock.Anything).Return(false).Maybe()
}

func privatePlaybook() Playbook {
	return Playbook{
		ID:      wsPlaybookID,
		TeamID:  wsTeamID,
		Public:  false,
		Members: []PlaybookMember{{UserID: wsPBMemberID, SchemeRoles: []string{PlaybookRoleMember}}},
	}
}

func privatePlaybookRun() *PlaybookRun {
	return &PlaybookRun{
		ID:             wsRunID,
		Type:           RunTypePlaybook,
		TeamID:         wsTeamID,
		ChannelID:      wsChannelID,
		PlaybookID:     wsPlaybookID,
		OwnerUserID:    wsOwnerID,
		ParticipantIDs: []string{wsOwnerID, wsParticipantID},
	}
}

// TestPublishRunEventToViewers_PrivateRunExcludesUnauthorizedChannelMembers is the regression
// test for the run data that channel-wide broadcasts leaked: a guest (or any other non-member
// of a private playbook) sitting in the run's linked channel must not be sent run contents.
func TestPublishRunEventToViewers_PrivateRunExcludesUnauthorizedChannelMembers(t *testing.T) {
	f := newRunWSFixture(t, privatePlaybook(), nil)
	f.setChannelMembers(wsOwnerID, wsParticipantID, wsPBMemberID, wsGuestID, wsStrangerID)
	f.allowTeamView(wsOwnerID, wsParticipantID, wsPBMemberID, wsGuestID, wsStrangerID)
	f.grantPlaybookMemberView()

	run := privatePlaybookRun()
	f.svc.PublishRunEventToViewers(playbookRunUpdatedWSEvent, run, run)

	assert.Empty(t, f.channelBroadcast, "a private run must never be broadcast channel-wide")
	assert.NotContains(t, f.usersNotified, wsGuestID, "a guest in the linked channel is not authorized to view the run")
	assert.NotContains(t, f.usersNotified, wsStrangerID, "a channel member outside the playbook is not authorized to view the run")
	assert.ElementsMatch(t, []string{wsOwnerID, wsParticipantID, wsPBMemberID}, f.usersNotified)
}

// TestPublishRunEventToViewers_PrivateRunReachesAuthorizedViewers is the positive path: the
// owner, participants, and playbook members keep receiving live updates.
func TestPublishRunEventToViewers_PrivateRunReachesAuthorizedViewers(t *testing.T) {
	f := newRunWSFixture(t, privatePlaybook(), nil)
	f.setChannelMembers(wsOwnerID, wsPBMemberID)
	f.allowTeamView(wsOwnerID, wsParticipantID, wsPBMemberID)
	f.grantPlaybookMemberView()

	run := privatePlaybookRun()
	f.svc.PublishRunEventToViewers(playbookRunUpdatedWSEvent, run, run)

	// wsParticipantID is a participant who is not in the channel, so the fan-out must reach
	// them without relying on channel membership.
	assert.ElementsMatch(t, []string{wsOwnerID, wsPBMemberID, wsParticipantID}, f.usersNotified)
}

// TestPublishRunEventToViewers_PublicPlaybookRunReachesTeamViewers confirms the unaffected
// path still works: a channel member who can view the public playbook keeps getting updates.
func TestPublishRunEventToViewers_PublicPlaybookRunReachesTeamViewers(t *testing.T) {
	playbook := privatePlaybook()
	playbook.Public = true
	playbook.Members = nil

	f := newRunWSFixture(t, playbook, nil)
	f.setChannelMembers(wsOwnerID, wsStrangerID, wsGuestID)
	f.api.On("HasPermissionToTeam", wsGuestID, wsTeamID, model.PermissionViewTeam).Return(true).Maybe()
	f.api.On("HasPermissionToTeam", wsGuestID, wsTeamID, mock.Anything).Return(false).Maybe()
	f.api.On("HasPermissionToTeam", mock.Anything, wsTeamID, mock.Anything).Return(true).Maybe()
	f.api.On("RolesGrantPermission", mock.Anything, mock.Anything).Return(false).Maybe()

	run := privatePlaybookRun()
	f.svc.PublishRunEventToViewers(playbookRunUpdatedWSEvent, run, run)

	assert.Contains(t, f.usersNotified, wsStrangerID, "a team member who can view the public playbook may view its runs")
	assert.NotContains(t, f.usersNotified, wsGuestID, "a guest cannot view playbooks, so it cannot view their runs")
}

// TestPublishRunEventToViewers_AdditionalUsersAreAlsoChecked covers the caller-supplied
// recipients, which previously bypassed any authorization check.
func TestPublishRunEventToViewers_AdditionalUsersAreAlsoChecked(t *testing.T) {
	f := newRunWSFixture(t, privatePlaybook(), nil)
	f.setChannelMembers(wsOwnerID)
	f.allowTeamView(wsOwnerID, wsParticipantID, wsPBMemberID, wsStrangerID)
	f.grantPlaybookMemberView()

	run := privatePlaybookRun()
	f.svc.PublishRunEventToViewers(playbookRunUpdatedWSEvent, run, run, wsPBMemberID, wsStrangerID)

	assert.Contains(t, f.usersNotified, wsPBMemberID)
	assert.NotContains(t, f.usersNotified, wsStrangerID)
}

// TestPublishRunEventToViewers_ChannelChecklistBroadcastsToChannel covers the run type whose
// view permission *is* channel access, where a channel broadcast matches the predicate.
func TestPublishRunEventToViewers_ChannelChecklistBroadcastsToChannel(t *testing.T) {
	f := newRunWSFixture(t, Playbook{}, nil)

	run := &PlaybookRun{
		ID:        wsRunID,
		Type:      RunTypeChannelChecklist,
		TeamID:    wsTeamID,
		ChannelID: wsChannelID,
	}
	f.svc.PublishRunEventToViewers(playbookRunUpdatedWSEvent, run, run)

	assert.Equal(t, []string{wsChannelID}, f.channelBroadcast)
	assert.Empty(t, f.usersNotified)
}

// TestPublishRunEventToViewers_ChannelChecklistChecksAdditionalUsers covers the recipients a
// channel broadcast cannot reach: they need channel access to be sent the run.
func TestPublishRunEventToViewers_ChannelChecklistChecksAdditionalUsers(t *testing.T) {
	f := newRunWSFixture(t, Playbook{}, nil)
	f.api.On("GetChannelMembersByIds", wsChannelID, []string{wsParticipantID, wsGuestID}).
		Return(model.ChannelMembers{}, nil).Maybe()
	f.allowTeamView(wsParticipantID, wsGuestID)
	f.api.On("HasPermissionToChannel", wsParticipantID, wsChannelID, model.PermissionReadChannel).Return(true).Maybe()
	f.api.On("HasPermissionToChannel", wsGuestID, wsChannelID, model.PermissionReadChannel).Return(false).Maybe()

	run := &PlaybookRun{
		ID:        wsRunID,
		Type:      RunTypeChannelChecklist,
		TeamID:    wsTeamID,
		ChannelID: wsChannelID,
	}
	f.svc.PublishRunEventToViewers(playbookRunUpdatedWSEvent, run, run, wsParticipantID, wsGuestID)

	assert.Equal(t, []string{wsChannelID}, f.channelBroadcast)
	assert.Equal(t, []string{wsParticipantID}, f.usersNotified)
}

// TestPublishRunEventToViewers_UnresolvablePlaybookKeepsParticipants checks the degraded path:
// if the parent playbook cannot be read we still must not fall back to a channel broadcast.
func TestPublishRunEventToViewers_UnresolvablePlaybookKeepsParticipants(t *testing.T) {
	f := newRunWSFixture(t, Playbook{}, ErrNotFound)
	f.setChannelMembers(wsOwnerID, wsParticipantID, wsGuestID)
	f.allowTeamView(wsOwnerID, wsParticipantID, wsGuestID)

	run := privatePlaybookRun()
	f.svc.PublishRunEventToViewers(playbookRunUpdatedWSEvent, run, run)

	assert.Empty(t, f.channelBroadcast)
	assert.ElementsMatch(t, []string{wsOwnerID, wsParticipantID}, f.usersNotified)
}

// TestPublishRunEventToViewers_PlaybookIsReadOncePerEvent guards the cost of the fan-out: a
// run channel can hold thousands of members, so the parent playbook must be read once per
// event rather than once per recipient — including when that read fails.
func TestPublishRunEventToViewers_PlaybookIsReadOncePerEvent(t *testing.T) {
	for name, playbookErr := range map[string]error{"readable playbook": nil, "unreadable playbook": ErrNotFound} {
		t.Run(name, func(t *testing.T) {
			f := newRunWSFixture(t, privatePlaybook(), playbookErr)
			f.setChannelMembers(wsPBMemberID, wsGuestID, wsStrangerID)
			f.allowTeamView(wsOwnerID, wsParticipantID, wsPBMemberID, wsGuestID, wsStrangerID)
			f.grantPlaybookMemberView()

			run := privatePlaybookRun()
			f.svc.PublishRunEventToViewers(playbookRunUpdatedWSEvent, run, run)

			assert.Equal(t, 1, f.playbooks.getCalls)
		})
	}
}

// TestPublishRunEventToViewers_TeamViewCheckedOncePerUser guards the fan-out cost: resolving one
// candidate's run access re-checks team-view several times (runView, PlaybookView, and role
// resolution), so without batch memoization a single event makes that call per user many times
// over. The check must instead hit the plugin API once per user per event.
func TestPublishRunEventToViewers_TeamViewCheckedOncePerUser(t *testing.T) {
	f := newRunWSFixture(t, privatePlaybook(), nil)
	f.setChannelMembers(wsStrangerID)
	f.allowTeamView(wsStrangerID)
	f.grantPlaybookMemberView()

	run := privatePlaybookRun()
	f.svc.PublishRunEventToViewers(playbookRunUpdatedWSEvent, run, run)

	teamViewChecks := 0
	for _, call := range f.api.Calls {
		if call.Method != "HasPermissionToTeam" {
			continue
		}
		if call.Arguments.Get(0) == wsStrangerID && call.Arguments.Get(2) == model.PermissionViewTeam {
			teamViewChecks++
		}
	}

	assert.Equal(t, 1, teamViewChecks, "team-view access should be resolved once per user per event, not re-checked for each permission")
}

// TestPublishRunEventToViewers_ChannelListingFailureKeepsParticipants checks that a failure to
// enumerate the channel still delivers to the owner and participants.
func TestPublishRunEventToViewers_ChannelListingFailureKeepsParticipants(t *testing.T) {
	f := newRunWSFixture(t, privatePlaybook(), nil)
	f.failChannelMembers()
	f.allowTeamView(wsOwnerID, wsParticipantID)

	run := privatePlaybookRun()
	f.svc.PublishRunEventToViewers(playbookRunUpdatedWSEvent, run, run)

	assert.Empty(t, f.channelBroadcast)
	assert.ElementsMatch(t, []string{wsOwnerID, wsParticipantID}, f.usersNotified)
}

// TestGetRunAudienceIDs_DeduplicatesAndIncludesParticipants documents that a user appearing as
// a channel member, a participant, and an additional recipient is only notified once.
func TestGetRunAudienceIDs_DeduplicatesAndIncludesParticipants(t *testing.T) {
	f := newRunWSFixture(t, privatePlaybook(), nil)
	f.setChannelMembers(wsOwnerID, wsGuestID)

	audience := f.svc.getRunAudienceIDs(privatePlaybookRun(), []string{wsOwnerID, wsStrangerID})

	assert.ElementsMatch(t, []string{wsOwnerID, wsGuestID, wsParticipantID, wsStrangerID}, audience)
}
