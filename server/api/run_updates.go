// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"fmt"
	"net/http"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// errInvalidRunUpdate marks a run update rejected because of its content rather than permissions.
var errInvalidRunUpdate = errors.New("invalid run update")

// runSettingsUpdate holds the run settings shared by PATCH /runs/{id} and the GraphQL updateRun mutation.
type runSettingsUpdate struct {
	ChannelID                               *string
	CreateChannelMemberOnNewParticipant     *bool
	RemoveChannelMemberOnRemovedParticipant *bool
	StatusUpdateBroadcastChannelsEnabled    *bool
	StatusUpdateBroadcastWebhooksEnabled    *bool
	BroadcastChannelIDs                     *[]string
	WebhookOnStatusUpdateURLs               *[]string
}

// addRunSettingsToSetmap validates the requested settings against the user's permissions
// and adds the resulting column updates to setmap.
func addRunSettingsToSetmap(
	pluginAPI *pluginapi.Client,
	permissions *app.PermissionsService,
	userID string,
	playbookRun *app.PlaybookRun,
	updates runSettingsUpdate,
	setmap map[string]any,
) error {
	addToSetmap(setmap, "CreateChannelMemberOnNewParticipant", updates.CreateChannelMemberOnNewParticipant)
	addToSetmap(setmap, "RemoveChannelMemberOnRemovedParticipant", updates.RemoveChannelMemberOnRemovedParticipant)
	addToSetmap(setmap, "StatusUpdateBroadcastChannelsEnabled", updates.StatusUpdateBroadcastChannelsEnabled)
	addToSetmap(setmap, "StatusUpdateBroadcastWebhooksEnabled", updates.StatusUpdateBroadcastWebhooksEnabled)

	if updates.ChannelID != nil {
		channel, err := pluginAPI.Channel.Get(*updates.ChannelID)
		if err != nil {
			return fmt.Errorf("%w: failed to get channel: %w", errInvalidRunUpdate, err)
		}

		// Playbook runs can't move to DM/GM channels, but checklists can. Team channels must
		// belong to the run's team, except for a checklist leaving a DM/GM.
		emptyTeamID := ""
		if channel.IsGroupOrDirect() {
			if playbookRun.Type == app.RunTypePlaybook {
				return errors.Wrap(app.ErrMalformedPlaybookRun, "playbook runs cannot be moved to direct or group message channels")
			}
			addToSetmap(setmap, "TeamID", &emptyTeamID)
		} else if playbookRun.TeamID == "" {
			addToSetmap(setmap, "TeamID", &channel.TeamId)
		} else if channel.TeamId != playbookRun.TeamID {
			return errors.Wrap(app.ErrMalformedPlaybookRun, "channel not in given team")
		}

		permission := model.PermissionManagePublicChannelProperties
		permissionMessage := "You are not able to manage public channel properties"
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelProperties
			permissionMessage = "You are not able to manage private channel properties"
		} else if channel.IsGroupOrDirect() {
			permission = model.PermissionReadChannel
			permissionMessage = "You do not have access to this channel"
		}

		if !pluginAPI.User.HasPermissionToChannel(userID, channel.Id, permission) {
			return errors.Wrap(app.ErrNoPermissions, permissionMessage)
		}
		addToSetmap(setmap, "ChannelID", updates.ChannelID)
		// The new channel was not created by this run, so clear the flag to prevent
		// auto-archive from archiving a channel that was not created for this run.
		falseVal := false
		addToSetmap(setmap, "ChannelCreatedByRun", &falseVal)
	}

	if updates.BroadcastChannelIDs != nil {
		if err := permissions.NoAddedBroadcastChannelsWithoutPermission(userID, *updates.BroadcastChannelIDs, playbookRun.BroadcastChannelIDs); err != nil {
			return err
		}
		addConcatToSetmap(setmap, "ConcatenatedBroadcastChannelIDs", updates.BroadcastChannelIDs)
	}

	if updates.WebhookOnStatusUpdateURLs != nil {
		if err := app.ValidateWebhookURLs(*updates.WebhookOnStatusUpdateURLs); err != nil {
			return fmt.Errorf("%w: %w", errInvalidRunUpdate, err)
		}
		addConcatToSetmap(setmap, "ConcatenatedWebhookOnStatusUpdateURLs", updates.WebhookOnStatusUpdateURLs)
	}

	return nil
}

func updatesOnlyRequesterMembership(requesterUserID string, userIDs []string) bool {
	return len(userIDs) == 1 && userIDs[0] == requesterUserID
}

// checkChangeRunParticipantsPermissions allows users to join or leave a run they can view,
// and requires manage permissions on an active run to change anyone else's membership.
func checkChangeRunParticipantsPermissions(
	permissions *app.PermissionsService,
	playbookRunService app.PlaybookRunService,
	requesterUserID string,
	runID string,
	userIDs []string,
) error {
	if updatesOnlyRequesterMembership(requesterUserID, userIDs) {
		if err := permissions.RunView(requesterUserID, runID); err != nil {
			return errors.Wrap(err, "attempted to modify own participation without permissions")
		}
		return nil
	}

	if err := permissions.RunManageProperties(requesterUserID, runID); err != nil {
		return errors.Wrap(err, "attempted to modify participants without permissions")
	}

	playbookRun, err := playbookRunService.GetPlaybookRun(runID)
	if err != nil {
		return err
	}

	return app.EnsureRunIsActive(playbookRun)
}

// handleRunUpdateError returns permission and validation errors to the client, and hides anything else.
func (h *ErrorHandler) handleRunUpdateError(w http.ResponseWriter, logger logrus.FieldLogger, err error) {
	switch {
	case errors.Is(err, app.ErrNoPermissions):
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, err.Error(), err)
	case errors.Is(err, app.ErrNotFound):
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "Not found", err)
	case errors.Is(err, app.ErrPlaybookRunNotActive),
		errors.Is(err, app.ErrMalformedPlaybookRun),
		errors.Is(err, errInvalidRunUpdate):
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, err.Error(), err)
	default:
		h.HandleError(w, logger, err)
	}
}
