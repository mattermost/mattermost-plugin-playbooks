// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package ops

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// Runs is the shared run path for HTTP and Weave.
type Runs struct {
	RunService      app.PlaybookRunService
	PlaybookService app.PlaybookService
	Permissions     *app.PermissionsService
	PluginAPI       *pluginapi.Client
}

func (s *Runs) gate(c Caller, teamID string, allow func(userID string) error) error {
	if err := allow(c.Principal); err != nil {
		return err
	}
	if err := c.Reject(teamID); err != nil {
		return err
	}
	if invoker := c.Other(); invoker != "" {
		if err := allow(invoker); err != nil {
			return err
		}
	}
	return nil
}

// Read loads one run. The principal needs view; a different invoker needs manage.
func (s *Runs) Read(c Caller, runID string) (*app.PlaybookRun, error) {
	if err := s.Permissions.RunView(c.Principal, runID); err != nil {
		return nil, err
	}
	run, err := s.RunService.GetPlaybookRun(runID)
	if err != nil {
		return nil, err
	}
	if err := c.Reject(run.TeamID); err != nil {
		return nil, err
	}
	if invoker := c.Other(); invoker != "" {
		if err := s.Permissions.RunManageProperties(invoker, runID); err != nil {
			return nil, err
		}
	}
	return run, nil
}

// ReadByChannel returns the single run in a channel. found is false when there is not exactly one.
func (s *Runs) ReadByChannel(c Caller, channelID string) (bool, *app.PlaybookRun, error) {
	if err := s.Permissions.ChannelView(c.Principal, channelID); err != nil {
		return false, nil, err
	}
	requesterInfo, err := app.GetRequesterInfo(c.Principal, s.PluginAPI)
	if err != nil {
		return false, nil, err
	}
	result, err := s.RunService.GetPlaybookRuns(requesterInfo, app.PlaybookRunFilterOptions{
		ChannelID: channelID,
		Page:      0,
		PerPage:   2,
	})
	if err != nil {
		return false, nil, err
	}
	if len(result.Items) != 1 {
		return false, nil, nil
	}
	run := result.Items[0]
	if err := c.Reject(run.TeamID); err != nil {
		return false, nil, err
	}
	if invoker := c.Other(); invoker != "" {
		if err := s.Permissions.ChannelView(invoker, channelID); err != nil {
			return false, nil, err
		}
	}
	return true, &run, nil
}

// Start creates a run from a playbook after the flow ceiling and the invoker create check.
func (s *Runs) Start(c Caller, playbookID, teamID, name, ownerID string) (*app.PlaybookRun, error) {
	if err := c.Reject(teamID); err != nil {
		return nil, err
	}
	if invoker := c.Other(); invoker != "" && playbookID != "" {
		pb, err := s.PlaybookService.Get(playbookID)
		if err != nil {
			return nil, err
		}
		if err := s.Permissions.RunCreate(invoker, pb, teamID); err != nil {
			return nil, err
		}
	}
	runType := app.RunTypeChannelChecklist
	if playbookID != "" {
		runType = app.RunTypePlaybook
	}
	return s.Create(app.PlaybookRun{
		OwnerUserID: ownerID,
		TeamID:      teamID,
		Name:        name,
		PlaybookID:  playbookID,
		Type:        runType,
	}, c.Principal, nil, app.RunSourcePost, nil)
}

// PostStatus posts a status update. It does not finish the run.
func (s *Runs) PostStatus(c Caller, runID, message string) error {
	run, err := s.RunService.GetPlaybookRun(runID)
	if err != nil {
		return err
	}
	if err := app.EnsureRunIsActive(run); err != nil {
		return err
	}
	if err := s.gate(c, run.TeamID, func(userID string) error {
		return s.Permissions.RunManageProperties(userID, runID)
	}); err != nil {
		return err
	}
	_, err = s.UpdateStatus(runID, c.Principal, app.StatusUpdateOptions{Message: message})
	return err
}

// Finish ends an active run.
func (s *Runs) Finish(c Caller, runID string) error {
	run, err := s.RunService.GetPlaybookRun(runID)
	if err != nil {
		return err
	}
	if err := s.gate(c, run.TeamID, func(userID string) error {
		return s.Permissions.RunFinish(userID, runID)
	}); err != nil {
		return err
	}
	return s.RunService.FinishPlaybookRun(runID, c.Principal)
}

// Restore reopens a finished run.
func (s *Runs) Restore(c Caller, runID string) error {
	run, err := s.RunService.GetPlaybookRun(runID)
	if err != nil {
		return err
	}
	if err := s.gate(c, run.TeamID, func(userID string) error {
		return s.Permissions.RunRestore(userID, runID)
	}); err != nil {
		return err
	}
	return s.RunService.RestorePlaybookRun(runID, c.Principal)
}

// SetTaskState changes one checklist item.
func (s *Runs) SetTaskState(c Caller, runID string, checklist, item int, newState string) error {
	run, err := s.RunService.GetPlaybookRun(runID)
	if err != nil {
		return err
	}
	if err := app.EnsureRunIsActive(run); err != nil {
		return err
	}
	if err := s.gate(c, run.TeamID, func(userID string) error {
		return s.Permissions.RunManageProperties(userID, runID)
	}); err != nil {
		return err
	}
	if !app.IsValidChecklistItemState(newState) {
		return errors.Wrap(app.ErrMalformedPlaybookRun, "bad parameter new state")
	}
	return s.RunService.ModifyCheckedState(runID, c.Principal, newState, checklist, item)
}

// AddTask appends a checklist item.
func (s *Runs) AddTask(c Caller, runID string, checklist int, title string) error {
	run, err := s.RunService.GetPlaybookRun(runID)
	if err != nil {
		return err
	}
	if err := app.EnsureRunIsActive(run); err != nil {
		return err
	}
	if err := s.gate(c, run.TeamID, func(userID string) error {
		return s.Permissions.RunManageProperties(userID, runID)
	}); err != nil {
		return err
	}
	title = strings.TrimSpace(title)
	if title == "" {
		return errors.Wrap(app.ErrMalformedPlaybookRun, "checklist item title must not be blank")
	}
	return s.RunService.AddChecklistItem(runID, c.Principal, checklist, app.ChecklistItem{Title: title})
}

func (s *Runs) Create(playbookRun app.PlaybookRun, userID string, createPublicRun *bool, source string, initialPropertyValues map[string]json.RawMessage) (*app.PlaybookRun, error) {
	// Validate initial data
	if playbookRun.ID != "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook run already has an id")
	}

	if playbookRun.CreateAt != 0 {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook run channel already has created at date")
	}

	if playbookRun.TeamID == "" && playbookRun.ChannelID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "must provide team or channel to create playbook run")
	}

	if strings.TrimSpace(playbookRun.Name) == "" && playbookRun.ChannelID == "" && playbookRun.PlaybookID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing name of playbook run")
	}

	// Retrieve channel if needed and validate it
	// If a channel is specified, ensure it's from the given team (if one provided), or
	// just grab the team for that channel.
	var channel *model.Channel
	var err error
	if playbookRun.ChannelID != "" {
		channel, err = s.PluginAPI.Channel.Get(playbookRun.ChannelID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get channel")
		}

		// For DM/GM channels, TeamID is always empty - override any provided value
		if channel.IsGroupOrDirect() {
			playbookRun.TeamID = ""
		} else if playbookRun.TeamID == "" {
			playbookRun.TeamID = channel.TeamId
		} else if channel.TeamId != playbookRun.TeamID {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "channel not in given team")
		}

		// Only checklists (no playbook) are allowed in DM/GM channels.
		// Playbook runs in DM/GM will be supported in a future release.
		if channel.IsGroupOrDirect() && playbookRun.PlaybookID != "" {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook runs are not supported in direct or group message channels")
		}
	}

	// Copy data from playbook if needed
	public := true
	if createPublicRun != nil {
		public = *createPublicRun
	}

	var playbook *app.Playbook
	// For runs off of a playbook, verify playbook as well as user having run_create
	// for this playbook (via playbook membership).
	if playbookRun.PlaybookID != "" {
		var pb app.Playbook
		pb, err = s.PlaybookService.Get(playbookRun.PlaybookID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook")
		}
		playbook = &pb

		if playbook.DeleteAt != 0 {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook is archived, cannot create a new run using an archived playbook")
		}

		if err = s.Permissions.RunCreate(userID, *playbook, playbookRun.TeamID); err != nil {
			return nil, err
		}

		if source == "dialog" && playbook.ChannelMode == app.PlaybookRunLinkExistingChannel && playbookRun.ChannelID == "" {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook is configured to be linked to existing channel but no channel is configured. Run can not be created from dialog")
		}

		if createPublicRun == nil {
			public = pb.CreatePublicPlaybookRun
		}

		// Playbook is now loaded; reject an empty name unless the ChannelNameTemplate is locked
		// (so it will generate one), or an existing channel is being linked (ChannelID != ""
		// means no new channel is created).
		if strings.TrimSpace(playbookRun.Name) == "" && playbookRun.ChannelID == "" &&
			!app.TemplateLocked(&pb, pb.ChannelNameTemplate) {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing name of playbook run")
		}

		playbookRun.SetChecklistFromPlaybook(*playbook)
		playbookRun.SetConfigurationFromPlaybook(*playbook, source)
	} else {
		// For checklists, verify a channel ID and verify user has permission to post in the channel below.
		if channel == nil {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "channel ID is required for checklists")
		}

	}

	// Check the permissions on the channel: the user must be able to create it or,
	// if one's already provided, they need to be able to manage it.
	if channel == nil {
		permission := model.PermissionCreatePrivateChannel
		permissionMessage := "You are not able to create a private channel"
		if public {
			permission = model.PermissionCreatePublicChannel
			permissionMessage = "You are not able to create a public channel"
		}
		if !s.PluginAPI.User.HasPermissionToTeam(userID, playbookRun.TeamID, permission) {
			return nil, errors.Wrap(app.ErrNoPermissions, permissionMessage)
		}
	} else {
		permission := model.PermissionManagePublicChannelProperties
		permissionMessage := "You are not able to manage public channel properties"
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelProperties
			permissionMessage = "You are not able to manage private channel properties"
		} else if channel.IsGroupOrDirect() {
			permission = model.PermissionReadChannel
			permissionMessage = "You do not have access to this channel"
		}

		if !s.PluginAPI.User.HasPermissionToChannel(userID, channel.Id, permission) {
			return nil, errors.Wrap(app.ErrNoPermissions, permissionMessage)
		}
	}

	// For channelChecklists specifically, verify user has permission to post in the channel
	if playbookRun.Type == app.RunTypeChannelChecklist && playbookRun.ChannelID != "" {
		if !s.PluginAPI.User.HasPermissionToChannel(userID, playbookRun.ChannelID, model.PermissionCreatePost) {
			return nil, errors.Wrap(app.ErrNoPermissions, "You do not have permission to create a checklist in this channel. You must be a member of the channel with posting permissions.")
		}
	}

	// Check the permissions on the provided post: the user must have access to the post's channel
	if playbookRun.PostID != "" {
		var post *model.Post
		post, err = s.PluginAPI.Post.GetPost(playbookRun.PostID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook run original post")
		}
		if !s.PluginAPI.User.HasPermissionToChannel(userID, post.ChannelId, model.PermissionReadChannel) {
			return nil, errors.New("user does not have access to the channel containing the playbook run's original post")
		}
	}

	if playbook != nil {
		// Pre-set ReporterUserID so {CREATOR} resolves during template resolution.
		// DefaultOwnerID fallback is applied inside ResolveRunCreationParams (only when playbook != nil).
		playbookRun.ReporterUserID = userID
		if err = s.RunService.ResolveRunCreationParams(&playbookRun, playbook, initialPropertyValues, source); err != nil {
			return nil, errors.Wrap(err, "failed to resolve run creation params")
		}
	}

	if playbookRun.OwnerUserID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing owner user id of playbook run")
	}

	playbookRunReturned, err := s.RunService.CreatePlaybookRun(&playbookRun, playbook, userID, public, source, initialPropertyValues)
	if err != nil {
		return nil, err
	}

	// force database retrieval to ensure all data is processed correctly (i.e participantIds)
	return s.RunService.GetPlaybookRun(playbookRunReturned.ID)

}


func (s *Runs) UpdateStatus(playbookRunID, userID string, options app.StatusUpdateOptions) (string, error) {

	if options.FinishRun {
		if err := s.Permissions.RunFinish(userID, playbookRunID); err != nil {
			return "Not authorized to finish this run", err
		}
	} else if err := s.Permissions.RunManageProperties(userID, playbookRunID); err != nil {
		return "Not authorized", err
	}

	options.Message = strings.TrimSpace(options.Message)
	if options.Message == "" {
		return "message must not be empty", errors.New("message field empty")
	}

	if options.Reminder <= 0 && !options.FinishRun {
		run, runErr := s.RunService.GetPlaybookRun(playbookRunID)
		if runErr != nil || run.ReminderTimerDefaultSeconds <= 0 {
			return "the reminder must be set and not 0", errors.New("reminder was 0")
		}
		// The JSON value is a number of seconds. The run's default is already
		// in seconds, so it is applied the same way a caller-supplied reminder is.
		options.Reminder = time.Duration(run.ReminderTimerDefaultSeconds)
	}
	if options.Reminder < 0 || options.FinishRun {
		options.Reminder = 0
	}
	options.Reminder = options.Reminder * time.Second

	if err := s.RunService.UpdateStatus(playbookRunID, userID, options); err != nil {
		return "An internal error has occurred. Check app server logs for details.", err
	}

	if options.FinishRun {
		if err := s.RunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
			return "An internal error has occurred. Check app server logs for details.", err
		}
	}

	return "", nil
}
