package loadtest

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sync"

	"github.com/blang/semver"
	ltcontrol "github.com/mattermost/mattermost-load-test-ng/loadtest/control"
	"github.com/mattermost/mattermost-load-test-ng/loadtest/plugins"
	ltplugins "github.com/mattermost/mattermost-load-test-ng/loadtest/plugins"
	ltstore "github.com/mattermost/mattermost-load-test-ng/loadtest/store"
	ltuser "github.com/mattermost/mattermost-load-test-ng/loadtest/user"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost/server/public/model"
)

const (
	TargetPlaybooks = 10
	TargetRuns      = 20
)

// GenController is a load-test controller for the Playbooks plugin, to be
// injected in the load-test tool's GenController tests.
// It implements the [ltplugins.Plugin] interface
type GenController struct {
	store *PluginStore
}

type state struct {
	targets    map[string]int64
	targetsMut sync.RWMutex
}

var globalState *state

const (
	StateTargetPlaybooks = "playbooks"
	StateTargetRuns      = "runs"
)

func init() {
	globalState = &state{
		targets: map[string]int64{
			StateTargetPlaybooks: 0,
			StateTargetRuns:      0,
		},
	}
}

func (s *state) inc(targetId string, targetVal int64) bool {
	s.targetsMut.Lock()
	defer s.targetsMut.Unlock()
	if s.targets[targetId] == targetVal {
		return false
	}
	s.targets[targetId]++
	return true
}

func (s *state) dec(targetId string) {
	s.targetsMut.Lock()
	defer s.targetsMut.Unlock()
	s.targets[targetId]--
}

func (s *state) get(targetId string) int64 {
	s.targetsMut.RLock()
	defer s.targetsMut.RUnlock()
	return s.targets[targetId]
}

const lettersWithSpaces = "abcd efghij klm nopqr st uvwx yz"

func randString(min int, max int) string {
	length := min + rand.Intn(max)
	str := ""
	for range length {
		str += string(lettersWithSpaces[rand.Intn(len(lettersWithSpaces))])
	}
	return str
}

func randBool(freqTrue float64) bool {
	return rand.Float64() < freqTrue
}

func randChecklistItem() client.ChecklistItem {
	return client.ChecklistItem{
		Title:       ltcontrol.GenerateRandomSentences(1 + rand.Intn(15)),
		Description: ltcontrol.GenerateRandomSentences(1 + rand.Intn(50)),
		// AssigneeID:  "",
		// Command:     "",
		// DueDate:     0,
		// TaskActions: []client.TaskAction{},
		// ConditionID:     "",
		// ConditionAction: "",
		// ConditionReason: "",
		// ID:               "",
		// State:            "",
		// StateModified:    0,
		// AssigneeModified: 0,
		// CommandLastRun:   0,
		// LastSkipped:      0,
		// UpdateAt:         0,
	}
}

func randChecklist() client.Checklist {
	numItems := 1 + rand.Intn(10)
	items := make([]client.ChecklistItem, 0, numItems)
	for range numItems {
		items = append(items, randChecklistItem())
	}

	return client.Checklist{
		Title: ltcontrol.GenerateRandomSentences(1 + rand.Intn(5)),
		Items: items,
	}
}

func (c *GenController) CreatePlaybook(u ltuser.User, pbClient *client.Client) (res ltcontrol.UserActionResponse) {
	if !globalState.inc(StateTargetPlaybooks, TargetPlaybooks) {
		return ltcontrol.UserActionResponse{Info: "target number of playbooks reached"}
	}
	defer func() {
		if res.Err != nil || res.Warn != "" {
			globalState.dec(StateTargetPlaybooks)
		}
	}()

	ctx := context.Background()

	// Get a random team the user is a member of
	team, err := u.Store().RandomTeam(ltstore.SelectMemberOf)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	// Get between 1 and 10 random team members
	numMembers := 1 + rand.Intn(10)
	members := make([]client.PlaybookMember, 0, numMembers)
	for range numMembers {
		teamMember, err := u.Store().RandomTeamMember(team.Id)
		if err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}
		members = append(members, client.PlaybookMember{
			UserID:      teamMember.UserId,
			Roles:       []string{app.PlaybookRoleMember},
			SchemeRoles: []string{},
		})
	}

	// Get the owner
	owner, err := u.Store().RandomTeamMember(team.Id)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	numChecklists := 1 + rand.Intn(5)
	checklists := make([]client.Checklist, 0, numChecklists)
	for range numChecklists {
		checklists = append(checklists, randChecklist())
	}

	id, err := pbClient.Playbooks.Create(ctx, client.PlaybookCreateOptions{
		Title:                                   ltcontrol.GenerateRandomSentences(1 + rand.Intn(5)),
		Description:                             ltcontrol.GenerateRandomSentences(1 + rand.Intn(50)),
		TeamID:                                  team.Id,
		Public:                                  randBool(0.5),
		CreatePublicPlaybookRun:                 randBool(0.5),
		Checklists:                              checklists,
		Members:                                 members,
		InviteUsersEnabled:                      false,
		DefaultOwnerID:                          owner.UserId,
		DefaultOwnerEnabled:                     randBool(0.5),
		CreateChannelMemberOnNewParticipant:     randBool(0.5),
		RemoveChannelMemberOnRemovedParticipant: randBool(0.5),
		// BroadcastChannelID:                      "",
		// ReminderMessageTemplate:                 "",
		// ReminderTimerDefaultSeconds:             0,
		// InvitedUserIDs:                          []string{},
		// InvitedGroupIDs:                         []string{},
		// BroadcastChannelIDs:                     []string{},
		// BroadcastEnabled:                        false,
		// Metrics:                                 []client.PlaybookMetricConfig{},
		// ChannelID:                               "",
		// ChannelMode:                             0,
	})
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	pb, err := pbClient.Playbooks.Get(ctx, id)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	if err := c.store.SetPlaybook(*pb); err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	msg := fmt.Sprintf("created playbook %q on team %q", id, team.DisplayName)
	return ltcontrol.UserActionResponse{Info: msg}
}

func (c *GenController) CreateRun(u ltuser.User, pbClient *client.Client) (res ltcontrol.UserActionResponse) {
	if !globalState.inc(StateTargetRuns, TargetRuns) {
		return ltcontrol.UserActionResponse{Info: "target number of runs reached"}
	}
	defer func() {
		if res.Err != nil || res.Warn != "" {
			globalState.dec(StateTargetRuns)
		}
	}()

	ctx := context.Background()

	// Get a random team the user is a member of
	team, err := u.Store().RandomTeam(ltstore.SelectMemberOf)
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	playbook, err := c.store.RandomPlaybook(team.Id)
	if err != nil {
		// Try to populate the list of playbooks in the store
		pbRes, err := pbClient.Playbooks.List(ctx, team.Id, 0, 100, client.PlaybookListOptions{})
		if err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}

		if len(pbRes.Items) == 0 {
			return ltcontrol.UserActionResponse{Err: errors.New("unable to retrieve any playbook")}
		}

		if err := c.store.SetPlaybooks(pbRes.Items); err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}

		if err := c.store.SetPlaybooks(pbRes.Items); err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}

		playbook, err = c.store.RandomPlaybook(team.Id)
		if err != nil {
			return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
		}
	}

	run, err := pbClient.PlaybookRuns.Create(ctx, client.PlaybookRunCreateOptions{
		Name:        ltcontrol.GenerateRandomSentences(1 + rand.Intn(5)),
		OwnerUserID: u.Store().Id(),
		TeamID:      team.Id,
		// ChannelID:       "",
		Description: ltcontrol.GenerateRandomSentences(1 + rand.Intn(50)),
		// PostID:          "",
		PlaybookID:      playbook.ID,
		CreatePublicRun: model.NewPointer(true),
		Type:            "playbook",
	})
	if err != nil {
		return ltcontrol.UserActionResponse{Err: ltcontrol.NewUserError(err)}
	}

	msg := fmt.Sprintf("created run %q from playbook %q on team %q", run.ID, playbook.ID, team.DisplayName)
	return ltcontrol.UserActionResponse{Info: msg}
}

// PluginId returns the ID of the Playbooks plugin.
//
//nolint:staticcheck
func (c *GenController) PluginId() string {
	return "playbooks"
}

// MinServerVersion returns the minimum version the Mattermost server must have
// to be able to run the registered actions.
func (c *GenController) MinServerVersion() semver.Version {
	return semver.MustParse("11.0.0")
}

// Actions returns a list of all the registered actions implemented by Playbooks.
func (c *GenController) Actions() []ltplugins.PluginAction {
	return []ltplugins.PluginAction{
		{
			Name:      "CreatePlaybook",
			Run:       wrapAction(c.CreatePlaybook),
			Frequency: 1.0,
		},
		{
			Name:      "CreateRun",
			Run:       wrapAction(c.CreateRun),
			Frequency: 1.0,
		},
	}
}

// ClearUserData resets the underlying store to clear all previously stored data.
func (c *GenController) ClearUserData() {
	c.store.Clear()
}

func (c *GenController) Done() bool {
	return globalState.get(StateTargetPlaybooks) >= TargetPlaybooks &&
		globalState.get(StateTargetRuns) >= TargetRuns
}

var _ plugins.GenPlugin = &GenController{}
