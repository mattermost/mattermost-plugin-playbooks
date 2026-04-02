// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"gopkg.in/guregu/null.v4"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// RunMutationCollection hold all mutation functions for a playbookRun
type PlaybookRootResolver struct {
}

func getGraphqlPlaybook(ctx context.Context, playbookID string) (*PlaybookResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err = c.permissions.PlaybookView(userID, playbookID); err != nil {
		return nil, classifyAppError(err)
	}

	playbook, err := c.playbookService.Get(playbookID)
	if err != nil {
		return nil, classifyAppError(err)
	}

	return &PlaybookResolver{playbook}, nil
}

func (r *PlaybookRootResolver) Playbook(ctx context.Context, args struct {
	ID string
}) (*PlaybookResolver, error) {
	if args.ID == "" {
		return nil, newGraphQLError(errors.New("playbook ID is required"))
	}
	return getGraphqlPlaybook(ctx, args.ID)
}

const maxPlaybooksPerPage = 10000

func (r *PlaybookRootResolver) Playbooks(ctx context.Context, args struct {
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
		if err = c.permissions.PlaybookList(userID, args.TeamID); err != nil {
			return nil, classifyAppError(err)
		}
	}

	isGuest, err := app.IsGuest(userID, c.pluginAPI)
	if err != nil {
		return nil, err
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
		WithMembershipOnly: isGuest || args.WithMembershipOnly, // Guests can only see playbooks if they are invited to them
		Page:               0,
		PerPage:            maxPlaybooksPerPage,
	}

	playbookResults, err := c.playbookService.GetPlaybooksForTeam(requesterInfo, args.TeamID, opts)
	if err != nil {
		return nil, classifyAppError(err)
	}

	filteredItems := c.permissions.FilterPlaybooksByViewPermission(userID, playbookResults.Items)

	ret := make([]*PlaybookResolver, 0, len(filteredItems))
	for _, pb := range filteredItems {
		ret = append(ret, &PlaybookResolver{pb})
	}

	return ret, nil
}

func (r *RunRootResolver) UpdatePlaybookFavorite(ctx context.Context, args struct {
	ID       string
	Favorite bool
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	if err = c.permissions.PlaybookView(userID, args.ID); err != nil {
		return "", classifyAppError(err)
	}

	currentPlaybook, err := c.playbookService.Get(args.ID)
	if err != nil {
		return "", classifyAppError(err)
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", classifyAppError(app.ErrPlaybookArchived)
	}

	if args.Favorite {
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

	return currentPlaybook.ID, nil
}

func (r *PlaybookRootResolver) UpdatePlaybook(ctx context.Context, args struct {
	ID      string
	Updates struct {
		Title                                   *string
		Description                             *string
		Public                                  *bool
		CreatePublicPlaybookRun                 *bool
		ReminderMessageTemplate                 *string
		ReminderTimerDefaultSeconds             *float64
		StatusUpdateEnabled                     *bool
		InvitedUserIDs                          *[]string
		InvitedGroupIDs                         *[]string
		InviteUsersEnabled                      *bool
		DefaultOwnerID                          *string
		DefaultOwnerEnabled                     *bool
		BroadcastChannelIDs                     *[]string
		BroadcastEnabled                        *bool
		WebhookOnCreationURLs                   *[]string
		WebhookOnCreationEnabled                *bool
		MessageOnJoin                           *string
		MessageOnJoinEnabled                    *bool
		RetrospectiveReminderIntervalSeconds    *float64
		RetrospectiveTemplate                   *string
		RetrospectiveEnabled                    *bool
		WebhookOnStatusUpdateURLs               *[]string
		WebhookOnStatusUpdateEnabled            *bool
		SignalAnyKeywords                       *[]string
		SignalAnyKeywordsEnabled                *bool
		CategorizeChannelEnabled                *bool
		CategoryName                            *string
		RunSummaryTemplateEnabled               *bool
		RunSummaryTemplate                      *string
		ChannelNameTemplate                     *string
		Checklists                              *[]UpdateChecklist
		CreateChannelMemberOnNewParticipant     *bool
		RemoveChannelMemberOnRemovedParticipant *bool
		ChannelID                               *string
		ChannelMode                             *string
		OwnerGroupOnlyActions                   *bool
		AdminOnlyEdit                           *bool
		NewChannelOnly                          *bool
		AutoArchiveChannel                      *bool
		RunNumberPrefix                         *string
		CreationRules                           *[]CreationRuleInput
	}
}) (string, error) {
	if !model.IsValidId(args.ID) {
		return "", newGraphQLError(errors.New("invalid playbook ID"))
	}

	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.ID)
	if err != nil {
		return "", classifyAppError(err)
	}

	if err := c.permissions.PlaybookEdit(userID, currentPlaybook); err != nil {
		return "", classifyAppError(err)
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", classifyAppError(app.ErrPlaybookArchived)
	}

	// Validate governance flag changes using shared logic.
	// Disabling AdminOnlyEdit is already gated: when AdminOnlyEdit is true, PlaybookEdit above
	// already restricts the caller to admins only.
	isAdmin := app.IsSystemAdmin(userID, c.pluginAPI)
	isPbAdmin := app.IsPlaybookAdminMember(userID, currentPlaybook)
	enableAdminOnlyEdit := args.Updates.AdminOnlyEdit != nil && *args.Updates.AdminOnlyEdit && !currentPlaybook.AdminOnlyEdit
	disableAdminOnlyEdit := args.Updates.AdminOnlyEdit != nil && !*args.Updates.AdminOnlyEdit && currentPlaybook.AdminOnlyEdit
	toggleOwnerGroupOnlyActions := args.Updates.OwnerGroupOnlyActions != nil && *args.Updates.OwnerGroupOnlyActions != currentPlaybook.OwnerGroupOnlyActions
	toggleNewChannelOnly := args.Updates.NewChannelOnly != nil && *args.Updates.NewChannelOnly != currentPlaybook.NewChannelOnly
	toggleAutoArchiveChannel := args.Updates.AutoArchiveChannel != nil && *args.Updates.AutoArchiveChannel != currentPlaybook.AutoArchiveChannel
	if err := app.ValidateGovernanceFlags(isAdmin, isPbAdmin, app.GovernanceFlagChanges{
		EnableAdminOnlyEdit:         enableAdminOnlyEdit,
		DisableAdminOnlyEdit:        disableAdminOnlyEdit,
		ToggleOwnerGroupOnlyActions: toggleOwnerGroupOnlyActions,
		ToggleNewChannelOnly:        toggleNewChannelOnly,
		ToggleAutoArchiveChannel:    toggleAutoArchiveChannel,
	}); err != nil {
		return "", classifyAppError(err)
	}
	// Warn when OwnerGroupOnlyActions is enabled: this immediately restricts all active runs
	// in this playbook so only the run owner can finish/restore them.
	if args.Updates.OwnerGroupOnlyActions != nil && *args.Updates.OwnerGroupOnlyActions && !currentPlaybook.OwnerGroupOnlyActions {
		c.logger.WithFields(logrus.Fields{
			"playbook_id": args.ID,
			"user_id":     userID,
		}).Warn("OwnerGroupOnlyActions enabled: all active runs in this playbook now require owner-level permission to finish or restore")
	}

	if args.Updates.ChannelNameTemplate != nil {
		if err := app.ValidateChannelNameTemplate(*args.Updates.ChannelNameTemplate); err != nil {
			return "", newGraphQLError(err)
		}
		propertyFields, err := c.propertyService.GetPropertyFields(args.ID)
		if err != nil {
			c.logger.WithError(err).Error("UpdatePlaybook: failed to load property fields for template validation")
			return "", classifyAppError(err)
		}
		if unknown := app.ValidateTemplate(*args.Updates.ChannelNameTemplate, app.ResolveOptions{Fields: propertyFields}); len(unknown) > 0 {
			return "", newGraphQLError(errors.New(app.UnknownTemplateFieldsError(unknown)))
		}
	}

	setmap := map[string]interface{}{}
	if args.Updates.Title != nil {
		trimmed := strings.TrimSpace(*args.Updates.Title)
		if trimmed == "" {
			return "", newGraphQLError(errors.New("playbook title must not be empty"))
		}
		args.Updates.Title = &trimmed
	}
	addToSetmap(setmap, "Title", args.Updates.Title)
	addToSetmap(setmap, "Description", args.Updates.Description)
	if args.Updates.Public != nil {
		if *args.Updates.Public {
			if err := c.permissions.PlaybookMakePublic(userID, currentPlaybook); err != nil {
				return "", classifyAppError(err)
			}
		} else {
			if err := c.permissions.PlaybookMakePrivate(userID, currentPlaybook); err != nil {
				return "", classifyAppError(err)
			}
		}
		if !c.licenceChecker.PlaybookAllowed(*args.Updates.Public) {
			return "", classifyAppError(errors.Wrapf(app.ErrLicensedFeature, "the playbook is not valid with the current license"))
		}
		addToSetmap(setmap, "Public", args.Updates.Public)
	}
	addToSetmap(setmap, "CreatePublicIncident", args.Updates.CreatePublicPlaybookRun)
	addToSetmap(setmap, "ReminderMessageTemplate", args.Updates.ReminderMessageTemplate)
	addToSetmap(setmap, "ReminderTimerDefaultSeconds", args.Updates.ReminderTimerDefaultSeconds)
	addToSetmap(setmap, "StatusUpdateEnabled", args.Updates.StatusUpdateEnabled)
	addToSetmap(setmap, "CreateChannelMemberOnNewParticipant", args.Updates.CreateChannelMemberOnNewParticipant)
	addToSetmap(setmap, "RemoveChannelMemberOnRemovedParticipant", args.Updates.RemoveChannelMemberOnRemovedParticipant)

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
		if !model.IsValidId(*args.Updates.DefaultOwnerID) {
			return "", newGraphQLError(errors.New("invalid default owner ID"))
		}
		if !c.pluginAPI.User.HasPermissionToTeam(*args.Updates.DefaultOwnerID, currentPlaybook.TeamID, model.PermissionViewTeam) {
			return "", classifyAppError(errors.Wrap(app.ErrNoPermissions, "default owner can't view team"))
		}
		addToSetmap(setmap, "DefaultCommanderID", args.Updates.DefaultOwnerID)
	}
	addToSetmap(setmap, "DefaultCommanderEnabled", args.Updates.DefaultOwnerEnabled)

	if args.Updates.BroadcastChannelIDs != nil {
		if err := c.permissions.NoAddedBroadcastChannelsWithoutPermission(userID, *args.Updates.BroadcastChannelIDs, currentPlaybook.BroadcastChannelIDs); err != nil {
			return "", classifyAppError(err)
		}
		addConcatToSetmap(setmap, "ConcatenatedBroadcastChannelIDs", args.Updates.BroadcastChannelIDs)
	}

	addToSetmap(setmap, "BroadcastEnabled", args.Updates.BroadcastEnabled)
	if args.Updates.WebhookOnCreationURLs != nil {
		if err := app.ValidateWebhookURLs(*args.Updates.WebhookOnCreationURLs); err != nil {
			return "", newGraphQLError(err)
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
			return "", newGraphQLError(err)
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
			return "", newGraphQLError(err)
		}
		addToSetmap(setmap, "CategoryName", args.Updates.CategoryName)
	}
	addToSetmap(setmap, "RunSummaryTemplateEnabled", args.Updates.RunSummaryTemplateEnabled)
	addToSetmap(setmap, "RunSummaryTemplate", args.Updates.RunSummaryTemplate)
	addToSetmap(setmap, "ChannelNameTemplate", args.Updates.ChannelNameTemplate)
	addToSetmap(setmap, "ChannelID", args.Updates.ChannelID)
	addToSetmap(setmap, "ChannelMode", args.Updates.ChannelMode)
	addToSetmap(setmap, "OwnerGroupOnlyActions", args.Updates.OwnerGroupOnlyActions)
	addToSetmap(setmap, "AdminOnlyEdit", args.Updates.AdminOnlyEdit)
	addToSetmap(setmap, "NewChannelOnly", args.Updates.NewChannelOnly)
	addToSetmap(setmap, "AutoArchiveChannel", args.Updates.AutoArchiveChannel)
	if args.Updates.CreationRules != nil {
		creationRules := make([]app.CreationRule, len(*args.Updates.CreationRules))
		for i, rule := range *args.Updates.CreationRules {
			ownerID := ""
			if rule.SetOwnerID != nil {
				ownerID = *rule.SetOwnerID
			}
			channelID := ""
			if rule.SetChannelID != nil {
				channelID = *rule.SetChannelID
			}
			inviteUserIDs := []string{}
			if rule.InviteUserIDs != nil {
				inviteUserIDs = *rule.InviteUserIDs
			}
			var condition *app.ConditionExprV1
			if rule.Condition != nil {
				condBytes, err := json.Marshal(*rule.Condition)
				if err != nil {
					return "", newGraphQLError(errors.Wrapf(err, "creation rule %d: failed to marshal condition", i))
				}
				var cond app.ConditionExprV1
				if err := json.Unmarshal(condBytes, &cond); err != nil {
					return "", newGraphQLError(errors.Wrapf(err, "creation rule %d: failed to unmarshal condition", i))
				}
				condition = &cond
			}
			creationRules[i] = app.CreationRule{
				Condition:     condition,
				SetOwnerID:    ownerID,
				SetChannelID:  channelID,
				InviteUserIDs: inviteUserIDs,
			}
		}
		if err := app.ValidateCreationRules(creationRules); err != nil {
			return "", newGraphQLError(errors.Wrap(err, "invalid creation rules"))
		}

		rulesJSON, err := json.Marshal(creationRules)
		if err != nil {
			return "", newGraphQLError(errors.Wrap(err, "failed to marshal creation rules"))
		}
		setmap["CreationRulesJSON"] = string(rulesJSON)
	}
	// Cross-field validation: reject combinations where the effective channel name template uses
	// {SEQ} but the effective run number prefix is empty.
	// NOTE: RunNumberPrefix is trimmed and validated further below before being added to setmap.
	effectiveTemplate := currentPlaybook.ChannelNameTemplate
	if args.Updates.ChannelNameTemplate != nil {
		effectiveTemplate = *args.Updates.ChannelNameTemplate
	}
	effectivePrefix := currentPlaybook.RunNumberPrefix
	if args.Updates.RunNumberPrefix != nil {
		effectivePrefix = app.NormalizeRunNumberPrefix(*args.Updates.RunNumberPrefix)
	}
	if err := app.ValidateChannelNameTemplateWithPrefix(effectiveTemplate, effectivePrefix); err != nil {
		return "", newGraphQLError(err)
	}

	// Validate NewChannelOnly + ChannelMode: reject incompatible combinations at save time.
	newChannelOnly := currentPlaybook.NewChannelOnly
	if args.Updates.NewChannelOnly != nil {
		newChannelOnly = *args.Updates.NewChannelOnly
	}
	effectiveChannelMode := currentPlaybook.ChannelMode
	if args.Updates.ChannelMode != nil {
		if err := effectiveChannelMode.UnmarshalText([]byte(*args.Updates.ChannelMode)); err != nil {
			return "", newGraphQLError(errors.Wrapf(err, "invalid channel mode: %s", *args.Updates.ChannelMode))
		}
	}
	if err := app.ValidateNewChannelOnlyMode(newChannelOnly, effectiveChannelMode); err != nil {
		return "", newGraphQLError(err)
	}

	// Cross-field validation: if status updates are enabled and ReminderTimerDefaultSeconds is 0,
	// auto-coerce to the default value (15 minutes). The coerced value is written back into
	// args.Updates.ReminderTimerDefaultSeconds so that addToSetmap persists it.
	effectiveTimer := currentPlaybook.ReminderTimerDefaultSeconds
	if args.Updates.ReminderTimerDefaultSeconds != nil {
		effectiveTimer = int64(*args.Updates.ReminderTimerDefaultSeconds)
	}
	effectiveStatusEnabled := currentPlaybook.StatusUpdateEnabled
	if args.Updates.StatusUpdateEnabled != nil {
		effectiveStatusEnabled = *args.Updates.StatusUpdateEnabled
	}
	app.ValidateStatusUpdateConfig(&effectiveTimer, effectiveStatusEnabled)
	// Propagate any coerced timer value back so it is persisted by addToSetmap below.
	if effectiveStatusEnabled && (args.Updates.ReminderTimerDefaultSeconds == nil || int64(*args.Updates.ReminderTimerDefaultSeconds) != effectiveTimer) {
		coerced := float64(effectiveTimer)
		args.Updates.ReminderTimerDefaultSeconds = &coerced
	}

	// Normalize AssigneeType values in checklists and validate companion ID fields.
	if args.Updates.Checklists != nil {
		for ci := range *args.Updates.Checklists {
			for ii := range (*args.Updates.Checklists)[ci].Items {
				item := &(*args.Updates.Checklists)[ci].Items[ii]
				if item.AssigneeType != nil {
					at := *item.AssigneeType
					if !app.IsValidAssigneeType(at) {
						at = ""
					}
					// Reject non-empty companion IDs that fail format validation.
					if at == app.AssigneeTypeGroup && item.AssigneeGroupID != nil && *item.AssigneeGroupID != "" && !model.IsValidId(*item.AssigneeGroupID) {
						return "", newGraphQLError(fmt.Errorf("checklist %d item %d: assignee_group_id %q is not a valid ID", ci, ii, *item.AssigneeGroupID))
					}
					if at == app.AssigneeTypePropertyUser && item.AssigneePropertyFieldID != nil && *item.AssigneePropertyFieldID != "" && !model.IsValidId(*item.AssigneePropertyFieldID) {
						return "", newGraphQLError(fmt.Errorf("checklist %d item %d: assignee_property_field_id %q is not a valid ID", ci, ii, *item.AssigneePropertyFieldID))
					}
					item.AssigneeType = &at
				}
			}
		}
	}

	// Not optimal graphql. Stopgap measure. Should be updated separately.
	if args.Updates.Checklists != nil {
		app.CleanUpChecklists(*args.Updates.Checklists)
		if err := validateUpdateTaskActions(*args.Updates.Checklists); err != nil {
			return "", newGraphQLError(errors.Wrapf(err, "failed to validate task actions in graphql json for playbook id: '%s'", args.ID))
		}
		checklistsJSON, err := json.Marshal(args.Updates.Checklists)
		if err != nil {
			return "", newGraphQLError(errors.Wrapf(err, "failed to marshal checklist in graphql json for playbook id: '%s'", args.ID))
		}
		setmap["ChecklistsJSON"] = checklistsJSON
	}

	if args.Updates.Checklists != nil || args.Updates.InvitedUserIDs != nil || args.Updates.InviteUsersEnabled != nil {
		if err := validatePreAssignmentUpdate(currentPlaybook, args.Updates.Checklists, args.Updates.InvitedUserIDs, args.Updates.InviteUsersEnabled); err != nil {
			return "", newGraphQLError(errors.Wrapf(err, "invalid user pre-assignment for playbook id: '%s'", args.ID))
		}
	}

	// Validate RunNumberPrefix format; trim so the persisted value is always clean.
	if args.Updates.RunNumberPrefix != nil {
		*args.Updates.RunNumberPrefix = app.NormalizeRunNumberPrefix(*args.Updates.RunNumberPrefix)
		if err := app.ValidateRunNumberPrefix(*args.Updates.RunNumberPrefix); err != nil {
			return "", newGraphQLError(err)
		}
		setmap["RunNumberPrefix"] = *args.Updates.RunNumberPrefix
	}

	if len(setmap) > 0 {
		if err := c.playbookService.GraphqlUpdate(args.ID, setmap); err != nil {
			return "", classifyAppError(err)
		}
	}

	return args.ID, nil
}

func (r *PlaybookRootResolver) AddPlaybookMember(ctx context.Context, args struct {
	PlaybookID string
	UserID     string
}) (string, error) {
	if !model.IsValidId(args.PlaybookID) {
		return "", newGraphQLError(errors.New("invalid playbook ID"))
	}
	if !model.IsValidId(args.UserID) {
		return "", newGraphQLError(errors.New("invalid user ID"))
	}

	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", classifyAppError(err)
	}

	// Member management is intentionally not gated by AdminOnlyEdit: managing who
	// belongs to a playbook is a membership concern, not a content-editing concern.
	// PlaybookManageMembers is the correct permission check here.
	if err := c.permissions.PlaybookManageMembers(userID, currentPlaybook); err != nil {
		return "", classifyAppError(err)
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", classifyAppError(app.ErrPlaybookArchived)
	}

	if err := c.playbookService.AddPlaybookMember(args.PlaybookID, args.UserID); err != nil {
		return "", classifyAppError(err)
	}

	return "", nil
}

func (r *PlaybookRootResolver) RemovePlaybookMember(ctx context.Context, args struct {
	PlaybookID string
	UserID     string
}) (string, error) {
	if !model.IsValidId(args.PlaybookID) {
		return "", newGraphQLError(errors.New("invalid playbook ID"))
	}
	if !model.IsValidId(args.UserID) {
		return "", newGraphQLError(errors.New("invalid user ID"))
	}

	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", classifyAppError(err)
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", classifyAppError(app.ErrPlaybookArchived)
	}

	// Member management is intentionally not gated by AdminOnlyEdit — see AddPlaybookMember.
	// Users may always remove themselves; removing others requires PlaybookManageMembers.
	if userID != args.UserID {
		if err := c.permissions.PlaybookManageMembers(userID, currentPlaybook); err != nil {
			return "", classifyAppError(err)
		}
	}

	if err := c.playbookService.RemovePlaybookMember(args.PlaybookID, args.UserID); err != nil {
		return "", classifyAppError(err)
	}

	return "", nil
}

func (r *PlaybookRootResolver) AddMetric(ctx context.Context, args struct {
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

	if !model.IsValidId(args.PlaybookID) {
		return "", newGraphQLError(errors.New("invalid playbook ID"))
	}

	if _, err := authorisePlaybookEdit(c, userID, args.PlaybookID); err != nil {
		return "", err
	}

	var target null.Int
	if args.Target == nil {
		target = null.NewInt(0, false)
	} else {
		target = null.IntFrom(int64(*args.Target))
	}

	if err := c.playbookService.AddMetric(args.PlaybookID, app.PlaybookMetricConfig{
		Title:       args.Title,
		Description: args.Description,
		Type:        args.Type,
		Target:      target,
	}); err != nil {
		return "", classifyAppError(err)
	}

	return args.PlaybookID, nil
}

func (r *PlaybookRootResolver) UpdateMetric(ctx context.Context, args struct {
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

	currentMetric, err := c.playbookService.GetMetric(args.ID)
	if err != nil {
		return "", classifyAppError(err)
	}

	if _, err := authorisePlaybookEdit(c, userID, currentMetric.PlaybookID); err != nil {
		return "", err
	}

	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Title", args.Title)
	addToSetmap(setmap, "Description", args.Description)
	if args.Target != nil {
		setmap["Target"] = null.IntFrom(int64(*args.Target))
	}
	if len(setmap) > 0 {
		if err := c.playbookService.UpdateMetric(args.ID, setmap); err != nil {
			return "", classifyAppError(err)
		}
	}

	return args.ID, nil
}

func (r *PlaybookRootResolver) DeleteMetric(ctx context.Context, args struct {
	ID string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	currentMetric, err := c.playbookService.GetMetric(args.ID)
	if err != nil {
		return "", classifyAppError(err)
	}

	if _, err := authorisePlaybookEdit(c, userID, currentMetric.PlaybookID); err != nil {
		return "", err
	}

	if err := c.playbookService.DeleteMetric(args.ID); err != nil {
		return "", classifyAppError(err)
	}

	return args.ID, nil
}

func validatePreAssignmentUpdate[T app.ChecklistCommon](pb app.Playbook, newChecklists *[]T, newInvitedUsers *[]string, newInviteUsersEnabled *bool) error {
	assignees := app.GetDistinctAssignees(pb.Checklists)
	if newChecklists != nil {
		assignees = app.GetDistinctAssignees(*newChecklists)
	}

	invitedUsers := pb.InvitedUserIDs
	if newInvitedUsers != nil {
		invitedUsers = *newInvitedUsers
	}

	inviteUsersEnabled := pb.InviteUsersEnabled
	if newInviteUsersEnabled != nil {
		inviteUsersEnabled = *newInviteUsersEnabled
	}

	return app.ValidatePreAssignment(assignees, invitedUsers, inviteUsersEnabled)
}

// validateUpdateTaskActions validates the taskactions in the given checklist
// NOTE: Any changes to this function must be made to function 'validateTaskActions' for the REST endpoint.
func validateUpdateTaskActions(checklists []UpdateChecklist) error {
	for _, checklist := range checklists {
		for _, item := range checklist.Items {
			if taskActions := item.TaskActions; taskActions != nil {
				// Limit task actions to 10
				if len(*taskActions) > 10 {
					return errors.Errorf("playbook cannot have more than 10 task actions")
				}
				for _, ta := range *taskActions {
					if err := app.ValidateTrigger(ta.Trigger); err != nil {
						return err
					}
					for _, a := range ta.Actions {
						if err := app.ValidateAction(a); err != nil {
							return err
						}
					}
				}
			}
		}
	}
	return nil
}
