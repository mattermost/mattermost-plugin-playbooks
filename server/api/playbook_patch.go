// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// patchPlaybook handles PATCH /playbooks/{id}.
// Accepts every GraphQL PlaybookUpdates field (plus run_number_prefix) as a partial update.
// Only fields present in the body change. Permission and validation checks mirror
// PlaybookRootResolver.UpdatePlaybook. Unknown fields are rejected. All changes are
// written in a single GraphqlUpdate.
func (h *PlaybookHandler) patchPlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookEdit(userID, playbook)) {
		return
	}

	if playbook.DeleteAt != 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Playbook cannot be modified", fmt.Errorf("playbook with id '%s' is archived", playbookID))
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)

	var updates client.PlaybookUpdateOptions
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&updates); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode request body", err)
		return
	}

	setmap, err := h.buildPlaybookPatchSetmap(userID, playbook, updates)
	if err != nil {
		h.handlePlaybookPatchError(w, c.logger, err)
		return
	}

	if err := h.playbookService.GraphqlUpdate(playbookID, setmap); err != nil {
		h.handlePlaybookWriteError(w, c.logger, err)
		return
	}

	updated, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, &updated, http.StatusOK)
}

func (h *PlaybookHandler) buildPlaybookPatchSetmap(userID string, current app.Playbook, updates client.PlaybookUpdateOptions) (map[string]interface{}, error) {
	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Title", updates.Title)
	addToSetmap(setmap, "Description", updates.Description)

	if updates.Public != nil {
		if *updates.Public {
			if err := h.permissions.PlaybookMakePublic(userID, current); err != nil {
				return nil, err
			}
		} else {
			if err := h.permissions.PlaybookMakePrivate(userID, current); err != nil {
				return nil, err
			}
		}
		if !h.licenseChecker.PlaybookAllowed(*updates.Public) {
			return nil, errors.Wrapf(app.ErrLicensedFeature, "the playbook is not valid with the current license")
		}
		addToSetmap(setmap, "Public", updates.Public)
	}

	addToSetmap(setmap, "CreatePublicIncident", updates.CreatePublicPlaybookRun)
	addToSetmap(setmap, "ReminderMessageTemplate", updates.ReminderMessageTemplate)
	addToSetmap(setmap, "ReminderTimerDefaultSeconds", updates.ReminderTimerDefaultSeconds)
	addToSetmap(setmap, "StatusUpdateEnabled", updates.StatusUpdateEnabled)
	addToSetmap(setmap, "CreateChannelMemberOnNewParticipant", updates.CreateChannelMemberOnNewParticipant)
	addToSetmap(setmap, "RemoveChannelMemberOnRemovedParticipant", updates.RemoveChannelMemberOnRemovedParticipant)

	if updates.InvitedUserIDs != nil {
		filtered := h.permissions.FilterInvitedUserIDs(*updates.InvitedUserIDs, current.TeamID)
		addConcatToSetmap(setmap, "ConcatenatedInvitedUserIDs", &filtered)
	}

	if updates.InvitedGroupIDs != nil {
		filtered := h.permissions.FilterInvitedGroupIDs(*updates.InvitedGroupIDs)
		addConcatToSetmap(setmap, "ConcatenatedInvitedGroupIDs", &filtered)
	}

	addToSetmap(setmap, "InviteUsersEnabled", updates.InviteUsersEnabled)

	if updates.DefaultOwnerID != nil {
		if !h.pluginAPI.User.HasPermissionToTeam(*updates.DefaultOwnerID, current.TeamID, model.PermissionViewTeam) {
			return nil, errors.Wrap(app.ErrNoPermissions, "default owner can't view team")
		}
		addToSetmap(setmap, "DefaultCommanderID", updates.DefaultOwnerID)
	}
	addToSetmap(setmap, "DefaultCommanderEnabled", updates.DefaultOwnerEnabled)

	if updates.BroadcastChannelIDs != nil {
		if err := h.permissions.NoAddedBroadcastChannelsWithoutPermission(userID, *updates.BroadcastChannelIDs, current.BroadcastChannelIDs); err != nil {
			return nil, err
		}
		addConcatToSetmap(setmap, "ConcatenatedBroadcastChannelIDs", updates.BroadcastChannelIDs)
	}

	addToSetmap(setmap, "BroadcastEnabled", updates.BroadcastEnabled)

	if updates.WebhookOnCreationURLs != nil {
		if err := app.ValidateWebhookURLs(*updates.WebhookOnCreationURLs); err != nil {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, err.Error())
		}
		addConcatToSetmap(setmap, "ConcatenatedWebhookOnCreationURLs", updates.WebhookOnCreationURLs)
	}
	addToSetmap(setmap, "WebhookOnCreationEnabled", updates.WebhookOnCreationEnabled)
	addToSetmap(setmap, "MessageOnJoin", updates.MessageOnJoin)
	addToSetmap(setmap, "MessageOnJoinEnabled", updates.MessageOnJoinEnabled)
	addToSetmap(setmap, "RetrospectiveReminderIntervalSeconds", updates.RetrospectiveReminderIntervalSeconds)
	addToSetmap(setmap, "RetrospectiveTemplate", updates.RetrospectiveTemplate)
	addToSetmap(setmap, "RetrospectiveEnabled", updates.RetrospectiveEnabled)

	if updates.WebhookOnStatusUpdateURLs != nil {
		if err := app.ValidateWebhookURLs(*updates.WebhookOnStatusUpdateURLs); err != nil {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, err.Error())
		}
		addConcatToSetmap(setmap, "ConcatenatedWebhookOnStatusUpdateURLs", updates.WebhookOnStatusUpdateURLs)
	}
	addToSetmap(setmap, "WebhookOnStatusUpdateEnabled", updates.WebhookOnStatusUpdateEnabled)

	if updates.SignalAnyKeywords != nil {
		valid := app.ProcessSignalAnyKeywords(*updates.SignalAnyKeywords)
		addConcatToSetmap(setmap, "ConcatenatedSignalAnyKeywords", &valid)
	}
	addToSetmap(setmap, "SignalAnyKeywordsEnabled", updates.SignalAnyKeywordsEnabled)
	addToSetmap(setmap, "CategorizeChannelEnabled", updates.CategorizeChannelEnabled)

	if updates.CategoryName != nil {
		if err := app.ValidateCategoryName(*updates.CategoryName); err != nil {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, err.Error())
		}
		addToSetmap(setmap, "CategoryName", updates.CategoryName)
	}

	addToSetmap(setmap, "RunSummaryTemplateEnabled", updates.RunSummaryTemplateEnabled)
	addToSetmap(setmap, "RunSummaryTemplate", updates.RunSummaryTemplate)

	if updates.ChannelNameTemplate != nil {
		if err := app.ValidateChannelNameTemplate(*updates.ChannelNameTemplate); err != nil {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, err.Error())
		}
		if *updates.ChannelNameTemplate != "" {
			fields, err := h.propertyService.GetPropertyFields(current.ID)
			if err != nil {
				return nil, err
			}
			if unknown := app.ValidateTemplate(*updates.ChannelNameTemplate, app.ResolveOptions{Fields: fields}); len(unknown) > 0 {
				return nil, errors.Wrapf(app.ErrMalformedPlaybookRun, "channel name template references unknown field(s): %s", joinComma(unknown))
			}
		}
		addToSetmap(setmap, "ChannelNameTemplate", updates.ChannelNameTemplate)
	}
	addToSetmap(setmap, "ChannelNameTemplateLocked", updates.ChannelNameTemplateLocked)
	addToSetmap(setmap, "ChannelID", updates.ChannelID)
	addToSetmap(setmap, "ChannelMode", updates.ChannelMode)

	if updates.RunNumberPrefix != nil {
		prefix := app.NormalizeRunNumberPrefix(*updates.RunNumberPrefix)
		if err := app.ValidateRunNumberPrefix(prefix); err != nil {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, err.Error())
		}
		if prefix != current.RunNumberPrefix {
			// Uniqueness is enforced by attempting a validated service update path via setmap;
			// check uniqueness the same way UpdateRunNumberPrefix does.
			if err := h.checkPatchRunNumberPrefixUnique(current.TeamID, prefix, current.ID); err != nil {
				return nil, err
			}
		}
		setmap["RunNumberPrefix"] = prefix
	}

	var updateChecklists *[]UpdateChecklist
	if updates.Checklists != nil {
		converted := toUpdateChecklists(*updates.Checklists)
		app.CleanUpChecklists(converted)
		if err := validateUpdateTaskActions(converted); err != nil {
			return nil, errors.Wrapf(err, "failed to validate task actions for playbook id: '%s'", current.ID)
		}
		if err := validateUpdateTaskRequirements(converted); err != nil {
			return nil, errors.Wrapf(err, "failed to validate checklist item requirements for playbook id: '%s'", current.ID)
		}
		if err := validateUpdateRequirementsExclusiveOfTaskActions(converted); err != nil {
			return nil, errors.Wrapf(err, "failed to validate checklist item exclusivity for playbook id: '%s'", current.ID)
		}
		checklistsJSON, err := json.Marshal(converted)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to marshal checklist for playbook id: '%s'", current.ID)
		}
		setmap["ChecklistsJSON"] = checklistsJSON
		updateChecklists = &converted
	}

	if updates.Checklists != nil || updates.InvitedUserIDs != nil || updates.InviteUsersEnabled != nil {
		if err := validatePreAssignmentUpdate(current, updateChecklists, updates.InvitedUserIDs, updates.InviteUsersEnabled); err != nil {
			return nil, errors.Wrapf(err, "invalid user pre-assignment for playbook id: '%s'", current.ID)
		}
	}

	return setmap, nil
}

func (h *PlaybookHandler) checkPatchRunNumberPrefixUnique(teamID, prefix, excludeID string) error {
	return h.playbookService.ValidateRunNumberPrefixUnique(teamID, prefix, excludeID)
}

func toUpdateChecklists(in []client.PlaybookChecklistUpdate) []UpdateChecklist {
	out := make([]UpdateChecklist, len(in))
	for i, cl := range in {
		items := make([]UpdateChecklistItem, len(cl.Items))
		for j, item := range cl.Items {
			items[j] = UpdateChecklistItem{
				Title:                   item.Title,
				State:                   item.State,
				StateModified:           item.StateModified,
				AssigneeID:              item.AssigneeID,
				AssigneeModified:        item.AssigneeModified,
				AssigneeType:            item.AssigneeType,
				AssigneePropertyFieldID: item.AssigneePropertyFieldID,
				AssigneeOnlyComplete:    item.AssigneeOnlyComplete,
				Command:                 item.Command,
				CommandLastRun:          item.CommandLastRun,
				Description:             item.Description,
				LastSkipped:             item.LastSkipped,
				DueDate:                 item.DueDate,
				TaskActions:             convertTaskActions(item.TaskActions),
				ConditionID:             item.ConditionID,
				Requirements:            convertRequirements(item.Requirements),
			}
		}
		out[i] = UpdateChecklist{Title: cl.Title, Items: items}
	}
	return out
}

func convertTaskActions(in *[]client.TaskAction) *[]app.TaskAction {
	if in == nil {
		return nil
	}
	out := make([]app.TaskAction, len(*in))
	for i, ta := range *in {
		actions := make([]app.Action, len(ta.Actions))
		for j, a := range ta.Actions {
			actions[j] = app.Action{Type: app.TaskActionType(a.Type), Payload: a.Payload}
		}
		out[i] = app.TaskAction{
			Trigger: app.Trigger{Type: app.TaskTriggerType(ta.Trigger.Type), Payload: ta.Trigger.Payload},
			Actions: actions,
		}
	}
	return &out
}

func convertRequirements(in *[]client.TaskRequirement) *[]app.TaskRequirement {
	if in == nil {
		return nil
	}
	out := make([]app.TaskRequirement, len(*in))
	for i, r := range *in {
		out[i] = app.TaskRequirement{ID: r.ID, Label: r.Label, Value: r.Value}
	}
	return &out
}

func joinComma(parts []string) string {
	return strings.Join(parts, ", ")
}

func (h *PlaybookHandler) handlePlaybookPatchError(w http.ResponseWriter, logger logrus.FieldLogger, err error) {
	switch {
	case errors.Is(err, app.ErrNoPermissions):
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, err.Error(), err)
	case errors.Is(err, app.ErrLicensedFeature):
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, err.Error(), err)
	case errors.Is(err, app.ErrDuplicateEntry):
		h.HandleErrorWithCode(w, logger, http.StatusConflict, app.ErrDuplicateEntry.Error(), err)
	case errors.Is(err, app.ErrMalformedPlaybookRun):
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, err.Error(), err)
	default:
		// Validation failures from checklist/pre-assignment often aren't typed.
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, err.Error(), err)
	}
}
