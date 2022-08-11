package api

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
	"gopkg.in/guregu/null.v4"
)

type RootResolver struct{}

func (r *RootResolver) Playbook(ctx context.Context, args struct {
	ID string
}) (*PlaybookResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	playbookID := args.ID
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.PlaybookView(userID, playbookID); err != nil {
		c.log.Warnf("public error message: %v; internal details: %v", "Not authorized", err)
		return nil, errors.New("Not authorized")
	}

	playbook, err := c.playbookService.Get(playbookID)
	if err != nil {
		return nil, err
	}

	return &PlaybookResolver{playbook}, nil
}

func (r *RootResolver) Playbooks(ctx context.Context, args struct {
	TeamID             string
	Sort               string
	Direction          string
	SearchTerm         string
	WithMembershipOnly bool
	WithArchived       bool
}) ([]*PlaybookResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if args.TeamID != "" {
		if err := c.permissions.PlaybookList(userID, args.TeamID); err != nil {
			c.log.Warnf("public error message: %v; internal details: %v", "Not authorized", err)
			return nil, errors.New("Not authorized")
		}
	}

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  args.TeamID,
		IsAdmin: app.IsSystemAdmin(userID, c.pluginAPI),
	}

	opts := app.PlaybookFilterOptions{
		Sort:               app.SortField(args.Sort),
		Direction:          app.SortDirection(args.Direction),
		SearchTerm:         args.SearchTerm,
		WithArchived:       args.WithArchived,
		WithMembershipOnly: args.WithMembershipOnly,
		Page:               0,
		PerPage:            10000,
	}

	playbookResults, err := c.playbookService.GetPlaybooksForTeam(requesterInfo, args.TeamID, opts)
	if err != nil {
		return nil, err
	}

	ret := make([]*PlaybookResolver, 0, len(playbookResults.Items))
	for _, pb := range playbookResults.Items {
		ret = append(ret, &PlaybookResolver{pb})
	}

	return ret, nil
}

func (r *RootResolver) Runs(ctx context.Context, args struct {
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

type UpdateChecklist struct {
	Title string                `json:"title"`
	Items []UpdateChecklistItem `json:"items"`
}

type UpdateChecklistItem struct {
	Title            string  `json:"title"`
	State            string  `json:"state"`
	StateModified    float64 `json:"state_modified"`
	AssigneeID       string  `json:"assignee_id"`
	AssigneeModified float64 `json:"assignee_modified"`
	Command          string  `json:"command"`
	CommandLastRun   float64 `json:"command_last_run"`
	Description      string  `json:"description"`
	LastSkipped      float64 `json:"delete_at"`
	DueDate          float64 `json:"due_date"`
}

func (r *RootResolver) UpdatePlaybook(ctx context.Context, args struct {
	ID      string
	Updates struct {
		Title                                *string
		Description                          *string
		Public                               *bool
		CreatePublicPlaybookRun              *bool
		ReminderMessageTemplate              *string
		ReminderTimerDefaultSeconds          *float64
		StatusUpdateEnabled                  *bool
		InvitedUserIDs                       *[]string
		InvitedGroupIDs                      *[]string
		InviteUsersEnabled                   *bool
		DefaultOwnerID                       *string
		DefaultOwnerEnabled                  *bool
		BroadcastChannelIDs                  *[]string
		BroadcastEnabled                     *bool
		WebhookOnCreationURLs                *[]string
		WebhookOnCreationEnabled             *bool
		MessageOnJoin                        *string
		MessageOnJoinEnabled                 *bool
		RetrospectiveReminderIntervalSeconds *float64
		RetrospectiveTemplate                *string
		RetrospectiveEnabled                 *bool
		WebhookOnStatusUpdateURLs            *[]string
		WebhookOnStatusUpdateEnabled         *bool
		SignalAnyKeywords                    *[]string
		SignalAnyKeywordsEnabled             *bool
		CategorizeChannelEnabled             *bool
		CategoryName                         *string
		RunSummaryTemplateEnabled            *bool
		RunSummaryTemplate                   *string
		ChannelNameTemplate                  *string
		Checklists                           *[]UpdateChecklist
		IsFavorite                           *bool
	}
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.ID)
	if err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Title", args.Updates.Title)
	addToSetmap(setmap, "Description", args.Updates.Description)
	if args.Updates.Public != nil {
		if *args.Updates.Public {
			if err := c.permissions.PlaybookMakePrivate(userID, currentPlaybook); err != nil {
				return "", errors.Wrap(err, "attempted to make playbook private without permissions")
			}
		} else {
			if err := c.permissions.PlaybookMakePublic(userID, currentPlaybook); err != nil {
				return "", errors.Wrap(err, "attempted to make playbook public without permissions")
			}
		}
		if c.licenceChecker.PlaybookAllowed(*args.Updates.Public) {
			return "", errors.Wrapf(app.ErrLicensedFeature, "the playbook is not valid with the current license")
		}
		addToSetmap(setmap, "Public", args.Updates.Public)
	}
	addToSetmap(setmap, "CreatePublicIncident", args.Updates.CreatePublicPlaybookRun)
	addToSetmap(setmap, "ReminderMessageTemplate", args.Updates.ReminderMessageTemplate)
	addToSetmap(setmap, "ReminderTimerDefaultSeconds", args.Updates.ReminderTimerDefaultSeconds)
	addToSetmap(setmap, "StatusUpdateEnabled", args.Updates.StatusUpdateEnabled)

	if args.Updates.InvitedUserIDs != nil {
		filteredInvitedUserIDs := c.permissions.FilterInvitedUserIDs(*args.Updates.InvitedUserIDs, currentPlaybook.TeamID)
		addConcatToSetmap(setmap, "ConcatenatedInvitedUserIDs", &filteredInvitedUserIDs)
	}

	if args.Updates.InvitedGroupIDs != nil {
		filteredInvitedGroupIDs := c.permissions.FilterInvitedGroupIDs(*args.Updates.InvitedGroupIDs)
		addConcatToSetmap(setmap, "ConcatenatedInvitedGroupIDs", &filteredInvitedGroupIDs)
	}

	addToSetmap(setmap, "InviteUsersEnabled", args.Updates.InviteUsersEnabled)
	if args.Updates.DefaultOwnerID != nil {
		if !c.pluginAPI.User.HasPermissionToTeam(*args.Updates.DefaultOwnerID, currentPlaybook.TeamID, model.PermissionViewTeam) {
			return "", errors.Wrap(app.ErrNoPermissions, "default owner can't view team")
		}
		addToSetmap(setmap, "DefaultCommanderID", args.Updates.DefaultOwnerID)
	}
	addToSetmap(setmap, "DefaultCommanderEnabled", args.Updates.DefaultOwnerEnabled)

	if args.Updates.BroadcastChannelIDs != nil {
		if err := c.permissions.NoAddedBroadcastChannelsWithoutPermission(userID, *args.Updates.BroadcastChannelIDs, currentPlaybook.BroadcastChannelIDs); err != nil {
			return "", err
		}
		addConcatToSetmap(setmap, "ConcatenatedBroadcastChannelIDs", args.Updates.BroadcastChannelIDs)
	}

	addToSetmap(setmap, "BroadcastEnabled", args.Updates.BroadcastEnabled)
	if args.Updates.WebhookOnCreationURLs != nil {
		if err := app.ValidateWebhookURLs(*args.Updates.WebhookOnCreationURLs); err != nil {
			return "", err
		}
		addConcatToSetmap(setmap, "ConcatenatedWebhookOnCreationURLs", args.Updates.WebhookOnCreationURLs)
	}
	addToSetmap(setmap, "WebhookOnCreationEnabled", args.Updates.WebhookOnCreationEnabled)
	addToSetmap(setmap, "MessageOnJoin", args.Updates.MessageOnJoin)
	addToSetmap(setmap, "MessageOnJoinEnabled", args.Updates.MessageOnJoinEnabled)
	addToSetmap(setmap, "RetrospectiveReminderIntervalSeconds", args.Updates.RetrospectiveReminderIntervalSeconds)
	addToSetmap(setmap, "RetrospectiveTemplate", args.Updates.RetrospectiveTemplate)
	addToSetmap(setmap, "RetrospectiveEnabled", args.Updates.RetrospectiveEnabled)
	if args.Updates.WebhookOnStatusUpdateURLs != nil {
		if err := app.ValidateWebhookURLs(*args.Updates.WebhookOnStatusUpdateURLs); err != nil {
			return "", err
		}
		addConcatToSetmap(setmap, "ConcatenatedWebhookOnStatusUpdateURLs", args.Updates.WebhookOnStatusUpdateURLs)
	}
	addToSetmap(setmap, "WebhookOnStatusUpdateEnabled", args.Updates.WebhookOnStatusUpdateEnabled)
	if args.Updates.SignalAnyKeywords != nil {
		validSignalAnyKeywords := app.ProcessSignalAnyKeywords(*args.Updates.SignalAnyKeywords)
		addConcatToSetmap(setmap, "ConcatenatedSignalAnyKeywords", &validSignalAnyKeywords)
	}
	addToSetmap(setmap, "SignalAnyKeywordsEnabled", args.Updates.SignalAnyKeywordsEnabled)
	addToSetmap(setmap, "CategorizeChannelEnabled", args.Updates.CategorizeChannelEnabled)
	if args.Updates.CategoryName != nil {
		if err := app.ValidateCategoryName(*args.Updates.CategoryName); err != nil {
			return "", err
		}
		addToSetmap(setmap, "CategoryName", args.Updates.CategoryName)
	}
	addToSetmap(setmap, "RunSummaryTemplateEnabled", args.Updates.RunSummaryTemplateEnabled)
	addToSetmap(setmap, "RunSummaryTemplate", args.Updates.RunSummaryTemplate)
	addToSetmap(setmap, "ChannelNameTemplate", args.Updates.ChannelNameTemplate)

	// Not optimal graphql. Stopgap measure. Should be updated seperately.
	if args.Updates.Checklists != nil {
		checklistsJSON, err := json.Marshal(args.Updates.Checklists)
		if err != nil {
			return "", errors.Wrapf(err, "failed to marshal checklist in graphql json for playbook id: '%s'", args.ID)
		}
		setmap["ChecklistsJSON"] = checklistsJSON
	}

	if len(setmap) > 0 {
		if err := c.playbookStore.GraphqlUpdate(args.ID, setmap); err != nil {
			return "", err
		}
	}

	if args.Updates.IsFavorite != nil {
		if *args.Updates.IsFavorite {
			if err := c.categoryService.AddFavorite(
				app.CategoryItem{
					ItemID: currentPlaybook.ID,
					Type:   app.PlaybookItemType,
				},
				currentPlaybook.TeamID,
				userID,
			); err != nil {
				return "", err
			}
		} else {
			if err := c.categoryService.DeleteFavorite(
				app.CategoryItem{
					ItemID: currentPlaybook.ID,
					Type:   app.PlaybookItemType,
				},
				currentPlaybook.TeamID,
				userID,
			); err != nil {
				return "", err
			}
		}
	}

	return args.ID, nil
}

func (r *RootResolver) UpdateRun(ctx context.Context, args struct {
	ID      string
	Updates struct {
		IsFavorite *bool
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

	if err := c.permissions.RunManageProperties(userID, playbookRun.ID); err != nil {
		return "", err
	}

	if args.Updates.IsFavorite != nil {
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

	return playbookRun.ID, nil
}

func (r *RootResolver) AddPlaybookMember(ctx context.Context, args struct {
	PlaybookID string
	UserID     string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	if err := c.permissions.PlaybookManageMembers(userID, currentPlaybook); err != nil {
		return "", errors.Wrap(err, "attempted to modify members without permissions")
	}

	if err := c.playbookStore.AddPlaybookMember(args.PlaybookID, args.UserID); err != nil {
		return "", errors.Wrap(err, "unable to add playbook member")
	}

	return "", nil
}

func (r *RootResolver) RemovePlaybookMember(ctx context.Context, args struct {
	PlaybookID string
	UserID     string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	if err := c.permissions.PlaybookManageMembers(userID, currentPlaybook); err != nil {
		return "", errors.Wrap(err, "attempted to modify members without permissions")
	}

	if err := c.playbookStore.RemovePlaybookMember(args.PlaybookID, args.UserID); err != nil {
		return "", errors.Wrap(err, "unable to remove playbook member")
	}

	return "", nil
}

func (r *RootResolver) AddMetric(ctx context.Context, args struct {
	PlaybookID  string
	Title       string
	Description string
	Type        string
	Target      *float64
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	var target null.Int
	if args.Target == nil {
		target = null.NewInt(0, false)
	} else {
		target = null.IntFrom(int64(*args.Target))
	}

	if err := c.playbookStore.AddMetric(args.PlaybookID, app.PlaybookMetricConfig{
		Title:       args.Title,
		Description: args.Description,
		Type:        args.Type,
		Target:      target,
	}); err != nil {
		return "", err
	}

	return args.PlaybookID, nil
}

func (r *RootResolver) UpdateMetric(ctx context.Context, args struct {
	ID          string
	Title       *string
	Description *string
	Target      *float64
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentMetric, err := c.playbookStore.GetMetric(args.ID)
	if err != nil {
		return "", err
	}

	currentPlaybook, err := c.playbookService.Get(currentMetric.PlaybookID)
	if err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Title", args.Title)
	addToSetmap(setmap, "Description", args.Description)
	if args.Target != nil {
		setmap["Target"] = null.IntFrom(int64(*args.Target))
	}
	if len(setmap) > 0 {
		if err := c.playbookStore.UpdateMetric(args.ID, setmap); err != nil {
			return "", err
		}
	}

	return args.ID, nil
}

func (r *RootResolver) DeleteMetric(ctx context.Context, args struct {
	ID string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentMetric, err := c.playbookStore.GetMetric(args.ID)
	if err != nil {
		return "", err
	}

	currentPlaybook, err := c.playbookService.Get(currentMetric.PlaybookID)
	if err != nil {
		return "", err
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	if err := c.playbookStore.DeleteMetric(args.ID); err != nil {
		return "", err
	}

	return args.ID, nil
}

func addToSetmap[T any](setmap map[string]interface{}, name string, value *T) {
	if value != nil {
		setmap[name] = *value
	}
}

func addConcatToSetmap(setmap map[string]interface{}, name string, value *[]string) {
	if value != nil {
		setmap[name] = strings.Join(*value, ",")
	}
}
