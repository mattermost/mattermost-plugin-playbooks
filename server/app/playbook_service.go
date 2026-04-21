// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/metrics"
)

const (
	playbookCreatedWSEvent  = "playbook_created"
	playbookArchivedWSEvent = "playbook_archived"
	playbookRestoredWSEvent = "playbook_restored"
)

type playbookService struct {
	store            PlaybookStore
	poster           bot.Poster
	api              *pluginapi.Client
	auditor          Auditor
	metricsService   *metrics.Metrics
	propertyService  PropertyService
	conditionService ConditionService
}

type InsightsOpts struct {
	StartUnixMilli int64
	Page           int
	PerPage        int
}

// NewPlaybookService returns a new playbook service
func NewPlaybookService(store PlaybookStore, poster bot.Poster, api *pluginapi.Client, auditor Auditor, metricsService *metrics.Metrics, propertyService PropertyService, conditionService ConditionService) PlaybookService {
	return &playbookService{
		store:            store,
		poster:           poster,
		api:              api,
		auditor:          auditor,
		metricsService:   metricsService,
		propertyService:  propertyService,
		conditionService: conditionService,
	}
}

func (s *playbookService) Create(playbook Playbook, userID string) (string, error) {
	auditRec := s.auditor.MakeAuditRecord("createPlaybook", model.AuditStatusFail)
	defer s.auditor.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterAuditableToAuditRec(auditRec, "playbook", playbook)

	playbook.CreateAt = model.GetMillis()
	playbook.UpdateAt = playbook.CreateAt

	playbook.RunNumberPrefix = NormalizeRunNumberPrefix(playbook.RunNumberPrefix)
	if err := ValidateRunNumberPrefix(playbook.RunNumberPrefix); err != nil {
		return "", err
	}
	if err := ValidateChannelNameTemplate(playbook.ChannelNameTemplate); err != nil {
		return "", err
	}

	// Perform the actual operation
	newID, err := s.store.Create(playbook)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return "", err
	}
	playbook.ID = newID

	s.poster.PublishWebsocketEventToTeam(playbookCreatedWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	if s.metricsService != nil {
		s.metricsService.IncrementPlaybookCreatedCount(1)
	}

	// Mark success and add result state
	auditRec.Success()
	auditRec.AddEventResultState(playbook)

	return newID, nil
}

func (s *playbookService) Import(data PlaybookImportData, userID string) (string, error) {
	auditRec := s.auditor.MakeAuditRecord("importPlaybook", model.AuditStatusFail)
	defer s.auditor.LogAuditRec(auditRec)

	playbook := data.Playbook
	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterToAuditRec(auditRec, "numProperties", len(data.Properties))
	model.AddEventParameterToAuditRec(auditRec, "numConditions", len(data.Conditions))
	model.AddEventParameterAuditableToAuditRec(auditRec, "playbook", playbook)

	condRefs := saveAndClearConditionRefs(&playbook)

	newPlaybookID, err := s.Create(playbook, userID)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return "", err
	}
	playbook.ID = newPlaybookID

	if len(data.Properties) == 0 && len(data.Conditions) == 0 {
		auditRec.Success()
		auditRec.AddEventResultState(playbook)
		return newPlaybookID, nil
	}

	propResult := s.createPropertiesFromExport(newPlaybookID, data.Properties)

	if len(data.Conditions) > 0 && len(propResult.FieldMappings) > 0 {
		propertyMappings := &PropertyCopyResult{
			FieldMappings:  propResult.FieldMappings,
			OptionMappings: propResult.OptionMappings,
			CopiedFields:   propResult.CopiedFields,
		}

		conditionMapping, err := s.conditionService.CreateConditionsFromExport(newPlaybookID, data.Conditions, propertyMappings)
		if err != nil {
			auditRec.AddErrorDesc("failed to create conditions from export: " + err.Error())
			return "", errors.Wrap(err, "failed to create conditions from export")
		}

		if len(conditionMapping) > 0 && len(condRefs) > 0 {
			updatedPlaybook, err := s.Get(newPlaybookID)
			if err != nil {
				auditRec.AddErrorDesc(err.Error())
				return "", errors.Wrap(err, "failed to get playbook for condition remapping")
			}

			remapChecklistConditions(&updatedPlaybook, conditionMapping, condRefs)

			if err := s.Update(updatedPlaybook, userID); err != nil {
				auditRec.AddErrorDesc(err.Error())
				return "", errors.Wrap(err, "failed to update playbook with remapped condition IDs")
			}
		}
	}

	auditRec.Success()
	auditRec.AddEventResultState(playbook)

	return newPlaybookID, nil
}

// GetPlaybookConditionsForExport retrieves all conditions for a playbook for export purposes.
func (s *playbookService) GetPlaybookConditionsForExport(playbookID string) ([]Condition, error) {
	result, err := s.conditionService.GetPlaybookConditions("", playbookID, 0, MaxConditionsPerPlaybook)
	if err != nil {
		return nil, err
	}
	return result.Items, nil
}

type exportedCondRef struct {
	checklistIdx    int
	itemIdx         int
	conditionID     string
	conditionAction ConditionAction
}

// saveAndClearConditionRefs extracts condition references from checklist items
// and clears them so the playbook can be created without dangling IDs.
func saveAndClearConditionRefs(playbook *Playbook) []exportedCondRef {
	var refs []exportedCondRef
	for i := range playbook.Checklists {
		for j := range playbook.Checklists[i].Items {
			if playbook.Checklists[i].Items[j].ConditionID != "" {
				refs = append(refs, exportedCondRef{
					checklistIdx:    i,
					itemIdx:         j,
					conditionID:     playbook.Checklists[i].Items[j].ConditionID,
					conditionAction: playbook.Checklists[i].Items[j].ConditionAction,
				})
			}
			playbook.Checklists[i].Items[j].ConditionID = ""
			playbook.Checklists[i].Items[j].ConditionAction = ""
		}
	}
	return refs
}

// remapChecklistConditions writes back condition IDs that were recreated during
// import, using the saved references from the original export.
func remapChecklistConditions(playbook *Playbook, conditionMapping map[string]*Condition, refs []exportedCondRef) {
	oldToNew := make(map[string]string, len(conditionMapping))
	for oldID, newCond := range conditionMapping {
		oldToNew[oldID] = newCond.ID
	}

	for _, ref := range refs {
		if ref.checklistIdx >= len(playbook.Checklists) ||
			ref.itemIdx >= len(playbook.Checklists[ref.checklistIdx].Items) {
			logrus.WithFields(logrus.Fields{
				"checklist_idx":  ref.checklistIdx,
				"item_idx":       ref.itemIdx,
				"num_checklists": len(playbook.Checklists),
			}).Warn("checklist structure changed after create, skipping condition remap for item")
			continue
		}
		if newCondID, ok := oldToNew[ref.conditionID]; ok {
			playbook.Checklists[ref.checklistIdx].Items[ref.itemIdx].ConditionID = newCondID
			playbook.Checklists[ref.checklistIdx].Items[ref.itemIdx].ConditionAction = ref.conditionAction
		}
	}
}

type importPropertyResult struct {
	FieldMappings  map[string]string
	OptionMappings map[string]string
	CopiedFields   []PropertyField
}

// createPropertiesFromExport creates property fields on the target playbook from
// exported data, builds old->new ID mappings, and remaps ParentID references.
func (s *playbookService) createPropertiesFromExport(playbookID string, properties []ExportPropertyField) importPropertyResult {
	result := importPropertyResult{
		FieldMappings:  make(map[string]string),
		OptionMappings: make(map[string]string),
	}

	for _, exportProp := range properties {
		newField := PropertyField{
			PropertyField: model.PropertyField{
				Name: exportProp.Name,
				Type: exportProp.Type,
			},
			Attrs: exportProp.Attrs,
		}
		createdField, err := s.propertyService.CreatePropertyField(playbookID, newField)
		if err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"playbook_id":       playbookID,
				"property_name":     exportProp.Name,
				"original_field_id": exportProp.ID,
			}).Warn("failed to create property field during import, skipping")
			continue
		}
		result.FieldMappings[exportProp.ID] = createdField.ID
		result.CopiedFields = append(result.CopiedFields, *createdField)

		if createdField.SupportsOptions() {
			for j, oldOption := range exportProp.Attrs.Options {
				if j < len(createdField.Attrs.Options) {
					result.OptionMappings[oldOption.GetID()] = createdField.Attrs.Options[j].GetID()
				}
			}
		}
	}

	for i, field := range result.CopiedFields {
		if field.Attrs.ParentID != "" {
			if newParentID, ok := result.FieldMappings[field.Attrs.ParentID]; ok {
				result.CopiedFields[i].Attrs.ParentID = newParentID
				updatedField := result.CopiedFields[i]
				if _, err := s.propertyService.UpdatePropertyField(playbookID, updatedField); err != nil {
					result.CopiedFields[i].Attrs.ParentID = ""
					logrus.WithError(err).WithFields(logrus.Fields{
						"playbook_id":   playbookID,
						"field_id":      field.ID,
						"old_parent_id": field.Attrs.ParentID,
						"new_parent_id": newParentID,
					}).Warn("failed to remap ParentID on imported property field, cleared to avoid dangling ref")
				}
			}
		}
	}

	return result
}

func (s *playbookService) Get(id string) (Playbook, error) {
	return s.store.Get(id)
}

func (s *playbookService) GetPlaybooks() ([]Playbook, error) {
	return s.store.GetPlaybooks()
}

func (s *playbookService) GetActivePlaybooks() ([]Playbook, error) {
	return s.store.GetActivePlaybooks()
}

func (s *playbookService) GetPlaybooksForTeam(requesterInfo RequesterInfo, teamID string, opts PlaybookFilterOptions) (GetPlaybooksResults, error) {
	return s.store.GetPlaybooksForTeam(requesterInfo, teamID, opts)
}

func (s *playbookService) Update(playbook Playbook, userID string) error {
	auditRec := s.auditor.MakeAuditRecord("updatePlaybook", model.AuditStatusFail)
	defer s.auditor.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterAuditableToAuditRec(auditRec, "playbook", playbook)

	if playbook.DeleteAt != 0 {
		err := errors.New("cannot update a playbook that is archived")
		auditRec.AddErrorDesc(err.Error())
		return err
	}

	playbook.RunNumberPrefix = NormalizeRunNumberPrefix(playbook.RunNumberPrefix)
	if err := ValidateRunNumberPrefix(playbook.RunNumberPrefix); err != nil {
		return err
	}
	if err := ValidateChannelNameTemplate(playbook.ChannelNameTemplate); err != nil {
		return err
	}

	playbook.UpdateAt = model.GetMillis()

	// Perform the actual operation
	if err := s.store.Update(playbook); err != nil {
		auditRec.AddErrorDesc(err.Error())
		return err
	}

	// Mark success and add result state
	auditRec.Success()
	auditRec.AddEventResultState(playbook)

	return nil
}

func (s *playbookService) Archive(playbook Playbook, userID string) error {
	auditRec := s.auditor.MakeAuditRecord("archivePlaybook", model.AuditStatusFail)
	defer s.auditor.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterAuditableToAuditRec(auditRec, "playbook", playbook)

	if playbook.ID == "" {
		err := errors.New("can't archive a playbook without an ID")
		auditRec.AddErrorDesc(err.Error())
		return err
	}

	// Perform the actual operation
	if err := s.store.Archive(playbook.ID); err != nil {
		auditRec.AddErrorDesc(err.Error())
		return err
	}

	if s.metricsService != nil {
		s.metricsService.IncrementPlaybookArchivedCount(1)
	}

	s.poster.PublishWebsocketEventToTeam(playbookArchivedWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	// Mark success and add result state
	auditRec.Success()
	auditRec.AddEventResultState(playbook)

	return nil
}

func (s *playbookService) Restore(playbook Playbook, userID string) error {
	auditRec := s.auditor.MakeAuditRecord("restorePlaybook", model.AuditStatusFail)
	defer s.auditor.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterAuditableToAuditRec(auditRec, "playbook", playbook)

	if playbook.ID == "" {
		err := errors.New("can't restore a playbook without an ID")
		auditRec.AddErrorDesc(err.Error())
		return err
	}

	if playbook.DeleteAt == 0 {
		// Already restored, mark as success
		auditRec.Success()
		auditRec.AddEventResultState(playbook)
		return nil
	}

	// Perform the actual operation
	if err := s.store.Restore(playbook.ID); err != nil {
		auditRec.AddErrorDesc(err.Error())
		return err
	}

	if s.metricsService != nil {
		s.metricsService.IncrementPlaybookRestoredCount(1)
	}

	s.poster.PublishWebsocketEventToTeam(playbookRestoredWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	// Mark success and add result state
	auditRec.Success()
	auditRec.AddEventResultState(playbook)

	return nil
}

// AutoFollow method lets user to auto-follow all runs of a specific playbook
func (s *playbookService) AutoFollow(playbookID, userID string) error {
	if err := s.store.AutoFollow(playbookID, userID); err != nil {
		return errors.Wrapf(err, "user `%s` failed to auto-follow the playbook `%s`", userID, playbookID)
	}

	_, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}
	return nil
}

// AutoUnfollow method lets user to not auto-follow the newly created playbook runs
func (s *playbookService) AutoUnfollow(playbookID, userID string) error {
	if err := s.store.AutoUnfollow(playbookID, userID); err != nil {
		return errors.Wrapf(err, "user `%s` failed to auto-unfollow the playbook `%s`", userID, playbookID)
	}

	_, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}
	return nil
}

// GetAutoFollows returns list of users who auto-follow a playbook
func (s *playbookService) GetAutoFollows(playbookID string) ([]string, error) {
	autoFollows, err := s.store.GetAutoFollows(playbookID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get auto-follows for the playbook `%s`", playbookID)
	}

	return autoFollows, nil
}

// Duplicate duplicates a playbook
func (s *playbookService) Duplicate(playbook Playbook, userID string) (string, error) {
	auditRec := s.auditor.MakeAuditRecord("duplicatePlaybook", model.AuditStatusFail)
	defer s.auditor.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterAuditableToAuditRec(auditRec, "originalPlaybook", playbook)

	logrus.WithFields(logrus.Fields{
		"original_playbook_id": playbook.ID,
		"user_id":              userID,
	})

	newPlaybook := playbook.Clone()
	newPlaybook.ID = ""
	// Empty metric IDs if there are such. Otherwise, metrics will not be saved in the database.
	for i := range newPlaybook.Metrics {
		newPlaybook.Metrics[i].ID = ""
	}
	newPlaybook.Title = "Copy of " + playbook.Title

	// RunNumberPrefix has a per-team unique constraint; clear it so the
	// duplicate can be created without conflicting. The user can configure
	// a new prefix after duplication. Also reset the counter and clear
	// ChannelNameTemplate since it may reference property fields that will
	// get new IDs or the {SEQ} token which requires a prefix.
	newPlaybook.RunNumberPrefix = ""
	newPlaybook.NextRunNumber = 0
	newPlaybook.ChannelNameTemplate = ""

	// On duplicating, make the current user the administrator.
	newPlaybook.Members = []PlaybookMember{{
		UserID: userID,
		Roles:  []string{PlaybookRoleMember, PlaybookRoleAdmin},
	}}

	// Create the playbook FIRST so it exists before we create properties/conditions
	playbookID, err := s.Create(newPlaybook, userID)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return "", err
	}
	newPlaybook.ID = playbookID

	// Copy property fields from the original playbook to the new playbook AFTER creating it
	propertyMappings, err := s.propertyService.CopyPlaybookPropertiesToPlaybook(playbook.ID, playbookID)
	if err != nil {
		logrus.WithError(err).WithFields(logrus.Fields{
			"original_playbook_id": playbook.ID,
			"new_playbook_id":      playbookID,
		}).Warn("failed to copy property fields to duplicated playbook - skipping condition copying since conditions require valid property field mappings")
	}

	// Copy conditions from the original playbook to the new playbook AFTER creating it
	var conditionMapping map[string]*Condition
	if propertyMappings != nil {
		conditionMapping, err = s.conditionService.CopyPlaybookConditionsToPlaybook(playbook.ID, playbookID, propertyMappings)
		if err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"original_playbook_id": playbook.ID,
				"new_playbook_id":      playbookID,
			}).Warn("failed to copy conditions to duplicated playbook - playbook will be created without conditions and condition-based checklist items may not work correctly")
		}
	}

	// Update checklist item condition IDs to reference the new condition IDs
	if len(conditionMapping) > 0 {
		// Need to get the playbook, update it, and save it back
		newPlaybook, err = s.Get(playbookID)
		if err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"playbook_id": playbookID,
			}).Error("failed to get newly created playbook for updating condition IDs")
			auditRec.AddErrorDesc(err.Error())
			return "", err
		}

		newPlaybook.SwapConditionIDs(conditionMapping)

		if err := s.Update(newPlaybook, userID); err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"playbook_id": playbookID,
			}).Error("failed to update playbook with new condition IDs")
			auditRec.AddErrorDesc(err.Error())
			return "", err
		}
	}

	// Mark success and add result state
	auditRec.Success()
	auditRec.AddEventResultState(newPlaybook)

	return playbookID, nil
}

// get top playbooks for teams
func (s *playbookService) GetTopPlaybooksForTeam(teamID, userID string, opts *InsightsOpts) (*PlaybooksInsightsList, error) {
	permissionFlag, err := licenseAndGuestCheck(s, userID, false)
	if err != nil {
		return nil, err
	}
	if !permissionFlag {
		return nil, errors.New("User cannot access playbooks insights")
	}

	return s.store.GetTopPlaybooksForTeam(teamID, userID, opts)
}

// get top playbooks for users
func (s *playbookService) GetTopPlaybooksForUser(teamID, userID string, opts *InsightsOpts) (*PlaybooksInsightsList, error) {
	permissionFlag, err := licenseAndGuestCheck(s, userID, true)
	if err != nil {
		return nil, err
	}
	if !permissionFlag {
		return nil, errors.New("User cannot access playbooks insights")
	}

	return s.store.GetTopPlaybooksForUser(teamID, userID, opts)
}

func licenseAndGuestCheck(s *playbookService, userID string, isMyInsights bool) (bool, error) {
	licenseError := errors.New("invalid license/authorization to use insights API")
	guestError := errors.New("Guests aren't authorized to use insights API")
	lic := s.api.System.GetLicense()

	user, err := s.api.User.Get(userID)
	if err != nil {
		return false, err
	}

	if user.IsGuest() {
		return false, guestError
	}

	if lic == nil && !isMyInsights {
		return false, licenseError
	}

	if !isMyInsights && (lic.SkuShortName != model.LicenseShortSkuProfessional && lic.SkuShortName != model.LicenseShortSkuEnterprise) {
		return false, licenseError
	}

	return true, nil
}

// CreatePropertyField creates a property field for a playbook and bumps the playbook's updated_at
func (s *playbookService) CreatePropertyField(playbookID string, propertyField PropertyField) (*PropertyField, error) {
	createdField, err := s.propertyService.CreatePropertyField(playbookID, propertyField)
	if err != nil {
		return nil, err
	}

	if err := s.store.BumpPlaybookUpdatedAt(playbookID); err != nil {
		return nil, errors.Wrap(err, "failed to bump playbook timestamp")
	}

	return createdField, nil
}

// UpdatePropertyField updates a property field for a playbook and bumps the playbook's updated_at
func (s *playbookService) UpdatePropertyField(playbookID string, propertyField PropertyField) (*PropertyField, error) {
	updatedField, err := s.propertyService.UpdatePropertyField(playbookID, propertyField)
	if err != nil {
		return nil, err
	}

	if err := s.store.BumpPlaybookUpdatedAt(playbookID); err != nil {
		return nil, errors.Wrap(err, "failed to bump playbook timestamp")
	}

	return updatedField, nil
}

// DeletePropertyField deletes a property field for a playbook and bumps the playbook's updated_at
func (s *playbookService) DeletePropertyField(playbookID, propertyID string) error {
	if err := s.propertyService.DeletePropertyField(playbookID, propertyID); err != nil {
		return err
	}

	if err := s.store.BumpPlaybookUpdatedAt(playbookID); err != nil {
		return errors.Wrap(err, "failed to bump playbook timestamp")
	}

	return nil
}

// ReorderPropertyFields reorders property fields for a playbook and bumps the playbook's updated_at
func (s *playbookService) ReorderPropertyFields(playbookID, fieldID string, targetPosition int) ([]PropertyField, error) {
	reorderedFields, err := s.propertyService.ReorderPropertyFields(playbookID, fieldID, targetPosition)
	if err != nil {
		return nil, err
	}

	if err := s.store.BumpPlaybookUpdatedAt(playbookID); err != nil {
		return nil, errors.Wrap(err, "failed to bump playbook timestamp")
	}

	return reorderedFields, nil
}

func (s *playbookService) IncrementRunNumber(playbookID string) (int64, error) {
	n, err := s.store.IncrementRunNumber(playbookID)
	if err != nil {
		return 0, errors.Wrap(err, "playbook_service.IncrementRunNumber")
	}
	return n, nil
}

func (s *playbookService) UpdateChannelNameTemplateAtomically(playbookID string, transformFn func(current string) string) error {
	return s.store.UpdateChannelNameTemplateAtomically(playbookID, transformFn)
}
