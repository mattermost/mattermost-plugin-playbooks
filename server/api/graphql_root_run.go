// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// RunRootResolver hold all queries and mutations for a playbookRun
type RunRootResolver struct {
}

// maxRunsPerPage bounds a single run listing, both when a client requests a page
// size and when it omits pagination entirely. Every run is hydrated with its full
// checklists, so an unbounded listing can cost far more memory than it appears to.
const maxRunsPerPage = 1000

// runsPerPage resolves the page size for a run listing. Page sizes at or below
// zero are left to the store, which reads them as an empty page.
func runsPerPage(first *int32) int {
	if first == nil || *first > maxRunsPerPage {
		return maxRunsPerPage
	}

	return int(*first)
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

	if err = c.recordBudget.reserve(1); err != nil {
		return nil, err
	}

	run, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		c.recordBudget.release(1)
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

	perPage := runsPerPage(args.First)

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

	if err = c.recordBudget.reserve(perPage); err != nil {
		return nil, err
	}

	runResults, err := c.playbookRunService.GetPlaybookRuns(requesterInfo, filterOptions)
	if err != nil {
		c.recordBudget.release(perPage)
		return nil, err
	}
	c.recordBudget.release(perPage - len(runResults.Items))

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
		return "", err
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

	if err = c.permissions.RunManageProperties(userID, args.ID); err != nil {
		return "", err
	}

	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return "", err
	}

	if err := app.EnsureRunIsActive(playbookRun); err != nil {
		return "", newGraphQLError(errors.Wrap(err, "cannot modify a finished run"))
	}

	now := model.GetMillis()

	// scalar updates
	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Name", args.Updates.Name)
	addToSetmap(setmap, "Description", args.Updates.Summary)
	if args.Updates.Summary != nil {
		addToSetmap(setmap, "SummaryModifiedAt", &now)
	}

	if err := addRunSettingsToSetmap(c.pluginAPI, c.permissions, userID, playbookRun, runSettingsUpdate{
		ChannelID:                               args.Updates.ChannelID,
		CreateChannelMemberOnNewParticipant:     args.Updates.CreateChannelMemberOnNewParticipant,
		RemoveChannelMemberOnRemovedParticipant: args.Updates.RemoveChannelMemberOnRemovedParticipant,
		StatusUpdateBroadcastChannelsEnabled:    args.Updates.StatusUpdateBroadcastChannelsEnabled,
		StatusUpdateBroadcastWebhooksEnabled:    args.Updates.StatusUpdateBroadcastWebhooksEnabled,
		BroadcastChannelIDs:                     args.Updates.BroadcastChannelIDs,
		WebhookOnStatusUpdateURLs:               args.Updates.WebhookOnStatusUpdateURLs,
	}, setmap); err != nil {
		return "", err
	}

	if err := c.playbookRunService.GraphqlUpdate(args.ID, setmap); err != nil {
		return "", err
	}

	return playbookRun.ID, nil
}

func (r *RunRootResolver) AddRunParticipants(ctx context.Context, args struct {
	RunID             string
	UserIDs           []string
	ForceAddToChannel bool
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := checkChangeRunParticipantsPermissions(c.permissions, c.playbookRunService, userID, args.RunID, args.UserIDs); err != nil {
		return "", participantsGraphQLError(err)
	}

	if _, err := c.playbookRunService.AddParticipants(args.RunID, args.UserIDs, userID, args.ForceAddToChannel, true); err != nil {
		return "", errors.Wrap(err, "failed to add participant from run")
	}

	return "", nil
}

func (r *RunRootResolver) RemoveRunParticipants(ctx context.Context, args struct {
	RunID   string
	UserIDs []string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := checkChangeRunParticipantsPermissions(c.permissions, c.playbookRunService, userID, args.RunID, args.UserIDs); err != nil {
		return "", participantsGraphQLError(err)
	}

	if err := c.playbookRunService.RemoveParticipants(args.RunID, args.UserIDs, userID); err != nil {
		return "", errors.Wrap(err, "failed to remove participant from run")
	}

	for _, userID := range args.UserIDs {
		if err := c.playbookRunService.Unfollow(args.RunID, userID); err != nil {
			return "", errors.Wrap(err, "failed to make participant to unfollow run")
		}
	}

	return "", nil
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

	if err := c.permissions.RunChangeOwner(requesterID, args.RunID); err != nil {
		return "", errors.Wrap(err, "attempted to modify the run owner without permissions")
	}

	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.RunID)
	if err != nil {
		return "", err
	}
	if err := app.EnsureRunIsActive(playbookRun); err != nil {
		return "", newGraphQLError(errors.Wrap(err, "cannot modify a finished run"))
	}

	if err := c.playbookRunService.ChangeOwner(args.RunID, requesterID, args.OwnerID); err != nil {
		return "", errors.Wrap(err, "failed to change the run owner")
	}

	return "", nil
}

// participantsGraphQLError exposes the finished-run reason to GraphQL clients, as other run mutations do.
func participantsGraphQLError(err error) error {
	if errors.Is(err, app.ErrPlaybookRunNotActive) {
		return newGraphQLError(errors.Wrap(err, "cannot modify a finished run"))
	}
	return err
}

func (r *RunRootResolver) UpdateRunTaskActions(ctx context.Context, args struct {
	RunID        string
	ChecklistNum float64
	ItemNum      float64
	TaskActions  *[]app.TaskAction
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	if args.TaskActions == nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err = c.permissions.RunManageProperties(userID, args.RunID); err != nil {
		return "", err
	}

	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.RunID)
	if err != nil {
		return "", err
	}
	if err := app.EnsureRunIsActive(playbookRun); err != nil {
		return "", newGraphQLError(errors.Wrap(err, "cannot modify a finished run"))
	}

	if err := validateTaskActions(*args.TaskActions); err != nil {
		return "", err
	}

	if err := c.playbookRunService.SetTaskActionsToChecklistItem(args.RunID, userID, int(args.ChecklistNum), int(args.ItemNum), *args.TaskActions); err != nil {
		return "", err
	}

	return "", nil
}
