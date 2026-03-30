// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

const maxBatchParticipantOps = 100

// RunRootResolver hold all queries and mutations for a playbookRun
type RunRootResolver struct {
}

func (r *RunRootResolver) Run(ctx context.Context, args struct {
	ID string `url:"id,omitempty"`
}) (*RunResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err = c.permissions.RunView(userID, args.ID); err != nil {
		return nil, err
	}

	run, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return nil, err
	}

	return &RunResolver{*run}, nil
}

func (r *RunRootResolver) Runs(ctx context.Context, args struct {
	TeamID                  string
	Sort                    string
	Direction               string
	Statuses                []string
	ParticipantOrFollowerID string
	ChannelID               string
	First                   *int32
	After                   *string
	Types                   []string
	// Default false will be applied by the schema
	OmitEnded bool
}) (*RunConnectionResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	requesterInfo, err := app.GetRequesterInfo(userID, c.pluginAPI)
	if err != nil {
		return nil, err
	}
	requesterInfo.TeamID = args.TeamID

	if args.ParticipantOrFollowerID == client.Me {
		args.ParticipantOrFollowerID = userID
	}

	const maxRunsPerPage = 1000
	perPage := maxRunsPerPage
	if args.First != nil {
		if requested := int(*args.First); requested < perPage {
			perPage = requested
		}
	}

	page := 0
	if args.After != nil {
		page, err = decodeRunConnectionCursor(*args.After)
		if err != nil {
			return nil, err
		}
	}

	filterOptions := app.PlaybookRunFilterOptions{
		Sort:                    app.SortField(args.Sort),
		Direction:               app.SortDirection(args.Direction),
		TeamID:                  args.TeamID,
		Statuses:                args.Statuses,
		ParticipantOrFollowerID: args.ParticipantOrFollowerID,
		ChannelID:               args.ChannelID,
		IncludeFavorites:        true,
		Types:                   args.Types,
		Page:                    page,
		PerPage:                 perPage,
		SkipExtras:              true,
		OmitEnded:               args.OmitEnded,
	}

	runResults, err := c.playbookRunService.GetPlaybookRuns(requesterInfo, filterOptions)
	if err != nil {
		return nil, classifyAppError(err)
	}

	return &RunConnectionResolver{results: *runResults, page: page}, nil
}

func (r *RunRootResolver) SetRunFavorite(ctx context.Context, args struct {
	ID  string
	Fav bool
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err = c.permissions.RunView(userID, args.ID); err != nil {
		return "", err
	}

	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return "", classifyAppError(err)
	}

	if args.Fav {
		if err := c.categoryService.AddFavorite(
			app.CategoryItem{
				ItemID: playbookRun.ID,
				Type:   app.RunItemType,
			},
			playbookRun.TeamID,
			userID,
		); err != nil {
			return "", err
		}
	} else {
		if err := c.categoryService.DeleteFavorite(
			app.CategoryItem{
				ItemID: playbookRun.ID,
				Type:   app.RunItemType,
			},
			playbookRun.TeamID,
			userID,
		); err != nil {
			return "", err
		}
	}

	return playbookRun.ID, nil
}

type RunUpdates struct {
	Name                                    *string
	Summary                                 *string
	ChannelID                               *string
	CreateChannelMemberOnNewParticipant     *bool
	RemoveChannelMemberOnRemovedParticipant *bool
	StatusUpdateBroadcastChannelsEnabled    *bool
	StatusUpdateBroadcastWebhooksEnabled    *bool
	BroadcastChannelIDs                     *[]string
	WebhookOnStatusUpdateURLs               *[]string
}

func (r *RunRootResolver) UpdateRun(ctx context.Context, args struct {
	ID      string
	Updates RunUpdates
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if !model.IsValidId(args.ID) {
		return "", newGraphQLError(errors.New("invalid run ID"))
	}

	if err = c.permissions.RunManageProperties(userID, args.ID); err != nil {
		return "", classifyAppError(err)
	}

	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return "", classifyAppError(err)
	}

	// Prevent updating name or summary on finished runs
	if err := app.ValidateRunUpdateOnFinished(playbookRun.CurrentStatus, args.Updates.Name != nil, args.Updates.Summary != nil); err != nil {
		return "", classifyAppError(err)
	}

	now := model.GetMillis()

	if args.Updates.Name != nil {
		trimmed, err := app.ValidateRunNameUpdate(*args.Updates.Name)
		if err != nil {
			return "", newGraphQLError(err)
		}
		args.Updates.Name = &trimmed
	}

	if args.Updates.Summary != nil {
		trimmed, err := app.ValidateRunSummaryUpdate(*args.Updates.Summary)
		if err != nil {
			return "", newGraphQLError(err)
		}
		args.Updates.Summary = &trimmed
	}

	// scalar updates
	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Name", args.Updates.Name)
	addToSetmap(setmap, "Description", args.Updates.Summary)
	addToSetmap(setmap, "CreateChannelMemberOnNewParticipant", args.Updates.CreateChannelMemberOnNewParticipant)
	addToSetmap(setmap, "RemoveChannelMemberOnRemovedParticipant", args.Updates.RemoveChannelMemberOnRemovedParticipant)
	addToSetmap(setmap, "StatusUpdateBroadcastChannelsEnabled", args.Updates.StatusUpdateBroadcastChannelsEnabled)
	addToSetmap(setmap, "StatusUpdateBroadcastWebhooksEnabled", args.Updates.StatusUpdateBroadcastWebhooksEnabled)

	if args.Updates.ChannelID != nil {
		channel, err := c.pluginAPI.Channel.Get(*args.Updates.ChannelID)
		if err != nil {
			var appErr *model.AppError
			if errors.As(err, &appErr) && appErr.StatusCode == http.StatusNotFound {
				return "", classifyAppError(app.ErrNotFound)
			}
			return "", classifyAppError(errors.Wrapf(err, "failed to get channel"))
		}

		if channel.TeamId != playbookRun.TeamID {
			return "", classifyAppError(errors.Wrap(app.ErrMalformedPlaybookRun, "channel not in given team"))
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

		if !c.pluginAPI.User.HasPermissionToChannel(userID, channel.Id, permission) {
			return "", classifyAppError(errors.Wrap(app.ErrNoPermissions, permissionMessage))
		}
		addToSetmap(setmap, "ChannelID", args.Updates.ChannelID)
	}

	if args.Updates.Summary != nil {
		addToSetmap(setmap, "SummaryModifiedAt", &now)
	}

	if args.Updates.BroadcastChannelIDs != nil {
		if err := c.permissions.NoAddedBroadcastChannelsWithoutPermission(userID, *args.Updates.BroadcastChannelIDs, playbookRun.BroadcastChannelIDs); err != nil {
			return "", classifyAppError(err)
		}
		addConcatToSetmap(setmap, "ConcatenatedBroadcastChannelIDs", args.Updates.BroadcastChannelIDs)
	}

	if args.Updates.WebhookOnStatusUpdateURLs != nil {
		if err := app.ValidateWebhookURLs(*args.Updates.WebhookOnStatusUpdateURLs); err != nil {
			return "", newGraphQLError(err)
		}
		addConcatToSetmap(setmap, "ConcatenatedWebhookOnStatusUpdateURLs", args.Updates.WebhookOnStatusUpdateURLs)
	}

	if err := c.playbookRunService.GraphqlUpdate(args.ID, setmap); err != nil {
		return "", classifyAppError(err)
	}

	return playbookRun.ID, nil
}

func (r *RunRootResolver) AddRunParticipants(ctx context.Context, args struct {
	RunID             string
	UserIDs           []string
	ForceAddToChannel bool
}) (string, error) {
	if !model.IsValidId(args.RunID) {
		return "", newGraphQLError(errors.New("invalid run ID"))
	}

	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if len(args.UserIDs) == 0 {
		return "", nil
	}
	if len(args.UserIDs) > maxBatchParticipantOps {
		return "", newGraphQLError(fmt.Errorf("too many users: maximum %d per call", maxBatchParticipantOps))
	}

	// When user is joining run RunView permission is enough, otherwise user need manage permissions
	if updatesOnlyRequesterMembership(userID, args.UserIDs) {
		if err := c.permissions.RunView(userID, args.RunID); err != nil {
			return "", classifyAppError(err)
		}
	} else {
		if err := c.permissions.RunManageProperties(userID, args.RunID); err != nil {
			return "", classifyAppError(err)
		}
	}

	if err := c.playbookRunService.AddParticipants(args.RunID, args.UserIDs, userID, args.ForceAddToChannel, true); err != nil {
		return "", classifyAppError(err)
	}

	return "", nil
}

func (r *RunRootResolver) RemoveRunParticipants(ctx context.Context, args struct {
	RunID   string
	UserIDs []string
}) (string, error) {
	if !model.IsValidId(args.RunID) {
		return "", newGraphQLError(errors.New("invalid run ID"))
	}

	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if len(args.UserIDs) == 0 {
		return "", nil
	}
	if len(args.UserIDs) > maxBatchParticipantOps {
		return "", newGraphQLError(fmt.Errorf("too many users: maximum %d per call", maxBatchParticipantOps))
	}

	// When user is leaving run RunView permission is enough, otherwise user need manage permissions
	if updatesOnlyRequesterMembership(userID, args.UserIDs) {
		if err := c.permissions.RunView(userID, args.RunID); err != nil {
			return "", classifyAppError(err)
		}
	} else {
		if err := c.permissions.RunManageProperties(userID, args.RunID); err != nil {
			return "", classifyAppError(err)
		}
	}

	if err := c.playbookRunService.RemoveParticipants(args.RunID, args.UserIDs, userID); err != nil {
		return "", classifyAppError(err)
	}

	if err := c.playbookRunService.UnfollowMultiple(args.RunID, args.UserIDs); err != nil {
		c.logger.WithError(err).Warn("failed to unfollow run after participant removal; participants were already removed")
	}

	return "", nil
}

func updatesOnlyRequesterMembership(requesterUserID string, userIDs []string) bool {
	return len(userIDs) == 1 && userIDs[0] == requesterUserID
}

func (r *RunRootResolver) ChangeRunOwner(ctx context.Context, args struct {
	RunID   string
	OwnerID string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	requesterID := c.r.Header.Get("Mattermost-User-ID")

	if err := app.ValidateOwnerID(args.OwnerID); err != nil {
		return "", newGraphQLError(err)
	}

	if !model.IsValidId(args.RunID) {
		return "", newGraphQLError(errors.New("invalid run ID"))
	}

	if err := c.permissions.RunChangeOwner(requesterID, args.RunID); err != nil {
		return "", classifyAppError(err)
	}

	if err := c.playbookRunService.ChangeOwner(args.RunID, requesterID, args.OwnerID); err != nil {
		return "", classifyAppError(err)
	}

	return "", nil
}

func (r *RunRootResolver) SetItemPropertyUserAssignee(ctx context.Context, args struct {
	RunID           string
	ChecklistNum    float64
	ItemNum         float64
	PropertyFieldID string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if !model.IsValidId(args.RunID) {
		return "", newGraphQLError(errors.New("invalid run ID"))
	}

	if args.ChecklistNum < 0 || args.ItemNum < 0 {
		return "", newGraphQLError(errors.New("checklist and item indices must be non-negative"))
	}

	if !model.IsValidId(args.PropertyFieldID) {
		return "", newGraphQLError(errors.New("invalid property field ID"))
	}

	if err = c.permissions.RunManageProperties(userID, args.RunID); err != nil {
		return "", classifyAppError(err)
	}

	if err := c.playbookRunService.SetPropertyUserAssignee(userID, args.RunID, int(args.ChecklistNum), int(args.ItemNum), args.PropertyFieldID); err != nil {
		return "", classifyAppError(err)
	}

	return "", nil
}

func (r *RunRootResolver) UpdateRunTaskActions(ctx context.Context, args struct {
	RunID        string
	ChecklistNum float64
	ItemNum      float64
	TaskActions  *[]app.TaskAction
}) (string, error) {
	if !model.IsValidId(args.RunID) {
		return "", newGraphQLError(errors.New("invalid run ID"))
	}
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	if args.TaskActions == nil {
		return "", newGraphQLError(errors.New("taskActions must not be nil"))
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err = c.permissions.RunManageProperties(userID, args.RunID); err != nil {
		return "", classifyAppError(err)
	}

	if err := validateTaskActions(*args.TaskActions); err != nil {
		return "", newGraphQLError(err)
	}

	if err := c.playbookRunService.SetTaskActionsToChecklistItem(args.RunID, userID, int(args.ChecklistNum), int(args.ItemNum), *args.TaskActions); err != nil {
		return "", classifyAppError(err)
	}

	return "", nil
}
