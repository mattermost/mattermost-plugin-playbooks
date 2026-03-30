// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/metrics"
)

const (
	playbookCreatedWSEvent  = "playbook_created"
	playbookArchivedWSEvent = "playbook_archived"
	playbookRestoredWSEvent = "playbook_restored"
	playbookUpdatedWSEvent  = "playbook_updated"
)

type playbookService struct {
	store           PlaybookStore
	poster          bot.Poster
	api             *pluginapi.Client
	pluginAPI       plugin.API
	metricsService  *metrics.Metrics
	propertyService PropertyService
}

type InsightsOpts struct {
	StartUnixMilli int64
	Page           int
	PerPage        int
}

// NewPlaybookService returns a new playbook service
func NewPlaybookService(store PlaybookStore, poster bot.Poster, api *pluginapi.Client, pluginAPI plugin.API, metricsService *metrics.Metrics, propertyService PropertyService) PlaybookService {
	return &playbookService{
		store:           store,
		poster:          poster,
		api:             api,
		pluginAPI:       pluginAPI,
		metricsService:  metricsService,
		propertyService: propertyService,
	}
}

func (s *playbookService) Create(playbook Playbook, userID string) (string, error) {
	auditRec := plugin.MakeAuditRecord("createPlaybook", model.AuditStatusFail)
	defer s.pluginAPI.LogAuditRec(auditRec)

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
	if err := ValidateCreationRules(playbook.CreationRules); err != nil {
		return "", err
	}

	// Perform the actual operation
	newID, err := s.store.Create(playbook)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return "", errors.Wrap(err, "failed to create playbook")
	}
	playbook.ID = newID

	s.poster.PublishWebsocketEventToTeam(playbookCreatedWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	s.metricsService.IncrementPlaybookCreatedCount(1)

	// Mark success and add result state
	auditRec.Success()
	auditRec.AddEventResultState(playbook)

	return newID, nil
}

func (s *playbookService) Import(playbook Playbook, userID string) (string, error) {
	auditRec := plugin.MakeAuditRecord("importPlaybook", model.AuditStatusFail)
	defer s.pluginAPI.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterAuditableToAuditRec(auditRec, "playbook", playbook)

	// Perform the actual operation
	newID, err := s.Create(playbook, userID)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return "", err
	}
	playbook.ID = newID

	// Mark success and add result state
	auditRec.Success()
	auditRec.AddEventResultState(playbook)

	return newID, nil
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
	auditRec := plugin.MakeAuditRecord("updatePlaybook", model.AuditStatusFail)
	defer s.pluginAPI.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterAuditableToAuditRec(auditRec, "playbook", playbook)

	if playbook.DeleteAt != 0 {
		err := errors.Wrap(ErrPlaybookArchived, "cannot update a playbook that is archived")
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
	if err := ValidateCreationRules(playbook.CreationRules); err != nil {
		return err
	}

	playbook.UpdateAt = model.GetMillis()

	// Perform the actual operation
	if err := s.store.Update(playbook); err != nil {
		auditRec.AddErrorDesc(err.Error())
		return errors.Wrap(err, "failed to update playbook")
	}

	s.publishPlaybookUpdatedEvent(playbook.ID, playbook.TeamID)

	// Mark success and add result state
	auditRec.Success()
	auditRec.AddEventResultState(playbook)

	return nil
}

func (s *playbookService) Archive(playbook Playbook, userID string) error {
	auditRec := plugin.MakeAuditRecord("archivePlaybook", model.AuditStatusFail)
	defer s.pluginAPI.LogAuditRec(auditRec)

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
		return errors.Wrapf(err, "failed to archive playbook %s", playbook.ID)
	}

	s.metricsService.IncrementPlaybookArchivedCount(1)

	s.poster.PublishWebsocketEventToTeam(playbookArchivedWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	// Mark success and add result state
	auditRec.Success()
	auditRec.AddEventResultState(playbook)

	return nil
}

func (s *playbookService) Restore(playbook Playbook, userID string) error {
	auditRec := plugin.MakeAuditRecord("restorePlaybook", model.AuditStatusFail)
	defer s.pluginAPI.LogAuditRec(auditRec)

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
		return errors.Wrapf(err, "failed to restore playbook %s", playbook.ID)
	}

	s.metricsService.IncrementPlaybookRestoredCount(1)

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
	return nil
}

// AutoUnfollow method lets user to not auto-follow the newly created playbook runs
func (s *playbookService) AutoUnfollow(playbookID, userID string) error {
	if err := s.store.AutoUnfollow(playbookID, userID); err != nil {
		return errors.Wrapf(err, "user `%s` failed to auto-unfollow the playbook `%s`", userID, playbookID)
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
	auditRec := plugin.MakeAuditRecord("duplicatePlaybook", model.AuditStatusFail)
	defer s.pluginAPI.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterAuditableToAuditRec(auditRec, "originalPlaybook", playbook)

	logrus.WithFields(logrus.Fields{
		"original_playbook_id": playbook.ID,
		"user_id":              userID,
	}).Debug("duplicating playbook")

	newPlaybook := playbook.Clone()
	newPlaybook.ID = ""
	// Empty metric IDs if there are such. Otherwise, metrics will not be saved in the database.
	for i := range newPlaybook.Metrics {
		newPlaybook.Metrics[i].ID = ""
	}
	newPlaybook.Title = "Copy of " + playbook.Title

	// On duplicating, make the current user the administrator.
	newPlaybook.Members = []PlaybookMember{{
		UserID: userID,
		Roles:  []string{PlaybookRoleMember, PlaybookRoleAdmin},
	}}

	// Perform the actual operation
	playbookID, err := s.Create(newPlaybook, userID)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return "", err
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
	pb, err := s.store.Get(playbookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get playbook for property field creation")
	}

	createdField, err := s.propertyService.CreatePropertyField(playbookID, propertyField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create property field")
	}

	if err := s.store.BumpPlaybookUpdatedAt(playbookID); err != nil {
		logrus.WithError(err).WithField("playbook_id", playbookID).Warn("failed to bump playbook timestamp after property field creation")
	}

	s.publishPlaybookUpdatedEvent(playbookID, pb.TeamID)

	return createdField, nil
}

// UpdatePropertyField updates a property field for a playbook and bumps the playbook's updated_at.
// When a field is renamed, automatically updates ChannelNameTemplate to reference the new name.
func (s *playbookService) UpdatePropertyField(playbookID string, propertyField PropertyField) (*PropertyField, error) {
	pb, err := s.store.Get(playbookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get playbook for property field update")
	}

	// NOTE: There is a narrow TOCTOU window between the GetPropertyFields read below and the
	// UpdatePropertyField write that follows. A concurrent rename of the same field could cause
	// the cascade to use a stale oldName. This is acceptable because field renames are infrequent
	// admin operations and the risk of cascading with a stale name is low.
	var oldName string
	existingFields, err := s.propertyService.GetPropertyFields(playbookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to load existing fields for rename cascade check")
	}
	for _, f := range existingFields {
		if f.ID == propertyField.ID {
			oldName = f.Name
			break
		}
	}
	if oldName == "" {
		return nil, errors.Wrapf(ErrNotFound, "property field %s not found on playbook %s", propertyField.ID, playbookID)
	}

	updatedField, err := s.propertyService.UpdatePropertyField(playbookID, propertyField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update property field")
	}

	// Cascade field rename into ChannelNameTemplate.
	if oldName != propertyField.Name {
		capturedOld, capturedNew := oldName, propertyField.Name
		if err := s.store.UpdateChannelNameTemplateAtomically(playbookID, func(current string) string {
			return ReplaceFieldInTemplate(current, capturedOld, capturedNew)
		}); err != nil {
			return nil, errors.Wrap(err, "failed to update name templates after field rename cascade")
		}
	}

	// Always bump UpdateAt to signal that the playbook changed (either the field itself or the template cascade).
	if err := s.store.BumpPlaybookUpdatedAt(playbookID); err != nil {
		logrus.WithError(err).WithField("playbook_id", playbookID).Warn("failed to bump playbook timestamp after property field update")
	}

	s.publishPlaybookUpdatedEvent(playbookID, pb.TeamID)

	return updatedField, nil
}

// DeletePropertyField deletes a property field for a playbook and bumps the playbook's updated_at
func (s *playbookService) DeletePropertyField(playbookID, propertyID string) error {
	pb, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to get playbook for property field deletion")
	}

	// NOTE: There is a narrow TOCTOU window between the GetPropertyFields read below and the
	// DeletePropertyField call that follows. A concurrent delete of the same field could cause
	// this cascade to attempt stripping a field that is already gone, which is harmless.
	// This is acceptable because field deletions are infrequent admin operations.
	var deletedFieldName string
	existingFields, err := s.propertyService.GetPropertyFields(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to load existing fields for delete cascade check")
	}
	for _, f := range existingFields {
		if f.ID == propertyID {
			deletedFieldName = f.Name
			break
		}
	}

	if err := s.propertyService.DeletePropertyField(playbookID, propertyID); err != nil {
		return errors.Wrap(err, "failed to delete property field")
	}

	// Cascade field deletion into ChannelNameTemplate.
	if deletedFieldName != "" {
		capturedName := deletedFieldName
		if err := s.store.UpdateChannelNameTemplateAtomically(playbookID, func(current string) string {
			return StripFieldFromTemplate(current, capturedName)
		}); err != nil {
			return errors.Wrap(err, "failed to update name templates after field delete cascade")
		}
	}

	// Always bump UpdateAt to signal that the playbook changed (either the field itself or the template cascade).
	if err := s.store.BumpPlaybookUpdatedAt(playbookID); err != nil {
		logrus.WithError(err).WithField("playbook_id", playbookID).Warn("failed to bump playbook timestamp after property field deletion")
	}

	s.publishPlaybookUpdatedEvent(playbookID, pb.TeamID)

	return nil
}

// ReorderPropertyFields reorders property fields for a playbook and bumps the playbook's updated_at
func (s *playbookService) ReorderPropertyFields(playbookID, fieldID string, targetPosition int) ([]PropertyField, error) {
	pb, err := s.store.Get(playbookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get playbook for property field reorder")
	}

	reorderedFields, err := s.propertyService.ReorderPropertyFields(playbookID, fieldID, targetPosition)
	if err != nil {
		return nil, errors.Wrap(err, "failed to reorder property fields")
	}

	if err := s.store.BumpPlaybookUpdatedAt(playbookID); err != nil {
		logrus.WithError(err).WithField("playbook_id", playbookID).Warn("failed to bump playbook timestamp after property field reorder")
	}

	s.publishPlaybookUpdatedEvent(playbookID, pb.TeamID)

	return reorderedFields, nil
}

// publishPlaybookUpdatedEvent publishes a WS event to notify connected clients to refresh playbook views.
func (s *playbookService) publishPlaybookUpdatedEvent(playbookID, teamID string) {
	s.poster.PublishWebsocketEventToTeam(playbookUpdatedWSEvent, map[string]interface{}{
		"teamID":     teamID,
		"playbookID": playbookID,
	}, teamID)
}

func (s *playbookService) IncrementRunNumber(playbookID string) (int64, error) {
	n, err := s.store.IncrementRunNumber(playbookID)
	if err != nil {
		return 0, errors.Wrap(err, "playbook_service.IncrementRunNumber")
	}
	return n, nil
}

func (s *playbookService) GraphqlUpdate(playbookID string, setmap map[string]interface{}) error {
	pb, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrapf(err, "failed to get playbook %s before graphql update", playbookID)
	}

	if err := s.store.GraphqlUpdate(playbookID, setmap); err != nil {
		return errors.Wrapf(err, "failed to graphql update playbook %s", playbookID)
	}

	s.publishPlaybookUpdatedEvent(playbookID, pb.TeamID)

	return nil
}

func (s *playbookService) AddPlaybookMember(playbookID, userID string) error {
	pb, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrapf(err, "failed to get playbook %s before adding member", playbookID)
	}

	if err := s.store.AddPlaybookMember(playbookID, userID); err != nil {
		return errors.Wrapf(err, "failed to add member %s to playbook %s", userID, playbookID)
	}

	s.publishPlaybookUpdatedEvent(playbookID, pb.TeamID)

	return nil
}

func (s *playbookService) RemovePlaybookMember(playbookID, userID string) error {
	pb, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrapf(err, "failed to get playbook %s before removing member", playbookID)
	}

	if err := s.store.RemovePlaybookMember(playbookID, userID); err != nil {
		return errors.Wrapf(err, "failed to remove member %s from playbook %s", userID, playbookID)
	}

	s.publishPlaybookUpdatedEvent(playbookID, pb.TeamID)

	return nil
}

func (s *playbookService) AddMetric(playbookID string, config PlaybookMetricConfig) error {
	pb, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrapf(err, "failed to get playbook %s before adding metric", playbookID)
	}

	if err := s.store.AddMetric(playbookID, config); err != nil {
		return errors.Wrapf(err, "failed to add metric to playbook %s", playbookID)
	}

	s.publishPlaybookUpdatedEvent(playbookID, pb.TeamID)

	return nil
}

func (s *playbookService) GetMetric(metricID string) (*PlaybookMetricConfig, error) {
	return s.store.GetMetric(metricID)
}

func (s *playbookService) UpdateMetric(metricID string, setmap map[string]interface{}) error {
	metric, err := s.store.GetMetric(metricID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve metric %s before update", metricID)
	}

	pb, err := s.store.Get(metric.PlaybookID)
	if err != nil {
		return errors.Wrapf(err, "failed to get playbook %s before updating metric", metric.PlaybookID)
	}

	if err := s.store.UpdateMetric(metricID, setmap); err != nil {
		return errors.Wrapf(err, "failed to update metric %s", metricID)
	}

	s.publishPlaybookUpdatedEvent(metric.PlaybookID, pb.TeamID)

	return nil
}

func (s *playbookService) DeleteMetric(metricID string) error {
	metric, err := s.store.GetMetric(metricID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve metric %s before deletion", metricID)
	}

	pb, err := s.store.Get(metric.PlaybookID)
	if err != nil {
		return errors.Wrapf(err, "failed to get playbook %s before deleting metric", metric.PlaybookID)
	}

	if err := s.store.DeleteMetric(metricID); err != nil {
		return errors.Wrapf(err, "failed to delete metric %s", metricID)
	}

	s.publishPlaybookUpdatedEvent(metric.PlaybookID, pb.TeamID)

	return nil
}

func (s *playbookService) UpdateChannelNameTemplateAtomically(playbookID string, transformFn func(current string) string) error {
	return s.store.UpdateChannelNameTemplateAtomically(playbookID, transformFn)
}
