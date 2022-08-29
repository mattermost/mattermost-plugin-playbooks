package api

import (
	"context"
	"strings"
	"time"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/pkg/errors"
)

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

	if err := c.permissions.RunView(userID, args.ID); err != nil {
		c.log.Warnf("public error message: %v; internal details: %v", "Not authorized", err)
		return nil, errors.New("Not authorized")
	}

	run, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return nil, err
	}

	return &RunResolver{*run}, nil
}

func (r *RunRootResolver) Runs(ctx context.Context, args struct {
	TeamID                  string `url:"team_id,omitempty"`
	Sort                    string
	Statuses                []string
	ParticipantOrFollowerID string `url:"participant_or_follower,omitempty"`
}) ([]*RunResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  args.TeamID,
		IsAdmin: app.IsSystemAdmin(userID, c.pluginAPI),
	}

	if args.ParticipantOrFollowerID == client.Me {
		args.ParticipantOrFollowerID = userID
	}

	filterOptions := app.PlaybookRunFilterOptions{
		Sort:                    app.SortField(args.Sort),
		TeamID:                  args.TeamID,
		Statuses:                args.Statuses,
		ParticipantOrFollowerID: args.ParticipantOrFollowerID,
		IncludeFavorites:        true,
		Page:                    0,
		PerPage:                 10000,
	}

	runResults, err := c.playbookRunService.GetPlaybookRuns(requesterInfo, filterOptions)
	if err != nil {
		return nil, err
	}

	ret := make([]*RunResolver, 0, len(runResults.Items))
	for _, run := range runResults.Items {
		ret = append(ret, &RunResolver{run})
	}

	return ret, nil
}

func (r *RunRootResolver) UpdateRun(ctx context.Context, args struct {
	ID      string
	Updates struct {
		Summary       *string
		Retrospective *string
		IsFavorite    *bool
	}
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return "", err
	}

	if args.Updates.IsFavorite != nil {
		if err := c.permissions.RunView(userID, playbookRun.ID); err != nil {
			return "", err
		}
		if *args.Updates.IsFavorite {
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
	}

	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Description", args.Updates.Summary)
	addToSetmap(setmap, "Retrospective", args.Updates.Retrospective)
	if len(setmap) > 0 {
		if err := c.playbookRunService.GraphqlUpdate(args.ID, setmap); err != nil {
			return "", err
		}
	}

	return playbookRun.ID, nil
}

func (r *RunRootResolver) PostRunStatusUpdate(ctx context.Context, args struct {
	RunID  string
	Update app.StatusUpdateOptions
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	playbookRunToModify, err := c.playbookRunService.GetPlaybookRun(args.RunID)
	if err != nil {
		return "", err
	}

	if !app.CanPostToChannel(userID, playbookRunToModify.ChannelID, c.pluginAPI) {
		// h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", fmt.Errorf("user %s cannot post to playbook run channel %s", userID, playbookRunToModify.ChannelID))
		return "", err
	}

	if publicMsg, internalErr := r.postStatusUpdate(c, args.RunID, userID, args.Update); internalErr != nil {
		// h.HandleErrorWithCode(w, http.StatusBadRequest, publicMsg, internalErr)
		return publicMsg, err
	}

	return "", nil
}

// updateStatus returns a publicMessage and an internal error
func (r *RunRootResolver) postStatusUpdate(c *Context, playbookRunID, userID string, options app.StatusUpdateOptions) (string, error) {
	options.Message = strings.TrimSpace(options.Message)
	if options.Message == "" {
		return "message must not be empty", errors.New("message field empty")
	}

	if options.Reminder <= 0 && !options.FinishRun {
		return "the reminder must be set and not 0", errors.New("reminder was 0")
	}
	if options.Reminder < 0 || options.FinishRun {
		options.Reminder = 0
	}
	options.Reminder = options.Reminder * time.Second

	if err := c.playbookRunService.UpdateStatus(playbookRunID, userID, options); err != nil {
		return "An internal error has occurred. Check app server logs for details.", err
	}

	if options.FinishRun {
		if err := c.playbookRunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
			return "An internal error has occurred. Check app server logs for details.", err
		}
	}

	return "", nil
}

func (r *RunRootResolver) AddRunParticipants(ctx context.Context, args struct {
	RunID   string
	UserIDs []string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunView(userID, args.RunID); err != nil {
		return "", errors.Wrap(err, "attempted to modify participants without permissions")
	}

	if err := c.playbookRunService.AddParticipants(args.RunID, args.UserIDs, userID); err != nil {
		return "", errors.Wrap(err, "failed to add participant from run")
	}

	for _, userID := range args.UserIDs {
		if err := c.playbookRunService.Follow(args.RunID, userID); err != nil {
			return "", errors.Wrap(err, "failed to make participant to unfollow run")
		}
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

	if err := c.permissions.RunView(userID, args.RunID); err != nil {
		return "", errors.Wrap(err, "attempted to modify participants without permissions")
	}

	if err := c.playbookRunService.RemoveParticipants(args.RunID, args.UserIDs); err != nil {
		return "", errors.Wrap(err, "failed to remove participant from run")
	}

	for _, userID := range args.UserIDs {
		if err := c.playbookRunService.Unfollow(args.RunID, userID); err != nil {
			return "", errors.Wrap(err, "failed to make participant to unfollow run")
		}
	}

	return "", nil
}
