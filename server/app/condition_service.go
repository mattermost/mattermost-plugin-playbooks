// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
)

const (
	conditionCreatedWSEvent = "condition_created"
	conditionUpdatedWSEvent = "condition_updated"
	conditionDeletedWSEvent = "condition_deleted"
)

type conditionService struct {
	store           ConditionStore
	propertyService PropertyService
	poster          bot.Poster
}

func NewConditionService(store ConditionStore, propertyService PropertyService, poster bot.Poster) ConditionService {
	return &conditionService{
		store:           store,
		propertyService: propertyService,
		poster:          poster,
	}
}

// CreatePlaybookCondition creates a new stored condition for a playbook
func (s *conditionService) CreatePlaybookCondition(userID string, condition Condition, teamID string) (*Condition, error) {
	propertyFields, err := s.propertyService.GetPropertyFields(condition.PlaybookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property fields for validation")
	}

	// Set metadata for creation
	now := model.GetMillis()
	condition.CreateAt = now
	condition.UpdateAt = now

	if err := condition.IsValid(true, propertyFields); err != nil {
		return nil, err
	}

	if condition.RunID != "" {
		return nil, errors.New("cannot create conditions with RunID - run conditions are system managed")
	}

	// Check condition limit for playbook
	currentCount, err := s.store.GetPlaybookConditionCount(condition.PlaybookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get current condition count")
	}

	if currentCount >= MaxConditionsPerPlaybook {
		return nil, errors.Errorf("cannot create condition: playbook already has the maximum allowed number of conditions (%d)", MaxConditionsPerPlaybook)
	}

	condition.ConditionExpr.Sanitize()

	createdCondition, err := s.store.CreateCondition(condition.PlaybookID, condition)
	if err != nil {
		return nil, err
	}

	if err := s.sendConditionCreatedWS(createdCondition, teamID); err != nil {
		// Log but don't fail the operation for websocket errors
		logrus.WithError(err).WithField("condition_id", createdCondition.ID).Error("failed to send condition created websocket event")
	}

	return createdCondition, nil
}

// GetPlaybookCondition retrieves a stored playbook condition by ID
func (s *conditionService) GetPlaybookCondition(userID, playbookID, conditionID string) (*Condition, error) {
	condition, err := s.store.GetCondition(playbookID, conditionID)
	if err != nil {
		return nil, err
	}
	return condition, nil
}

// UpdatePlaybookCondition updates an existing stored condition for a playbook
func (s *conditionService) UpdatePlaybookCondition(userID string, condition Condition, teamID string) (*Condition, error) {
	existing, err := s.store.GetCondition(condition.PlaybookID, condition.ID)
	if err != nil {
		return nil, err
	}

	if existing.RunID != "" {
		return nil, errors.New("cannot modify conditions associated with a run - run conditions are read-only")
	}

	if condition.RunID != "" {
		return nil, errors.New("cannot associate existing condition with a run - run conditions are system managed")
	}

	// Preserve immutable fields from existing condition
	condition.CreateAt = existing.CreateAt
	condition.UpdateAt = model.GetMillis()

	propertyFields, err := s.propertyService.GetPropertyFields(condition.PlaybookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property fields for validation")
	}

	if err := condition.IsValid(false, propertyFields); err != nil {
		return nil, err
	}

	condition.ConditionExpr.Sanitize()

	updatedCondition, err := s.store.UpdateCondition(condition.PlaybookID, condition)
	if err != nil {
		return nil, err
	}

	if err := s.sendConditionUpdatedWS(updatedCondition, teamID); err != nil {
		// Log but don't fail the operation for websocket errors
		logrus.WithError(err).WithField("condition_id", updatedCondition.ID).Error("failed to send condition updated websocket event")
	}

	return updatedCondition, nil
}

// DeletePlaybookCondition soft-deletes a stored condition for a playbook
func (s *conditionService) DeletePlaybookCondition(userID, playbookID, conditionID string, teamID string) error {
	existing, err := s.store.GetCondition(playbookID, conditionID)
	if err != nil {
		return err
	}

	if existing.RunID != "" {
		return errors.New("cannot delete conditions associated with a run - run conditions are read-only")
	}

	if err := s.sendConditionDeletedWS(existing, teamID); err != nil {
		// Log but don't fail the operation for websocket errors
		logrus.WithError(err).WithField("condition_id", existing.ID).Error("failed to send condition deleted websocket event")
	}

	return s.store.DeleteCondition(playbookID, conditionID)
}

// GetPlaybookConditions retrieves stored conditions for a playbook
func (s *conditionService) GetPlaybookConditions(userID, playbookID string, page, perPage int) (*GetConditionsResults, error) {
	fetchConditions := func() ([]Condition, error) {
		return s.store.GetPlaybookConditions(playbookID, page, perPage)
	}

	fetchCount := func() (int, error) {
		return s.store.GetPlaybookConditionCount(playbookID)
	}

	return s.getConditions(fetchConditions, fetchCount, page, perPage)
}

// GetRunConditions retrieves stored conditions for a run
func (s *conditionService) GetRunConditions(userID, playbookID, runID string, page, perPage int) (*GetConditionsResults, error) {
	fetchConditions := func() ([]Condition, error) {
		return s.store.GetRunConditions(playbookID, runID, page, perPage)
	}

	fetchCount := func() (int, error) {
		return s.store.GetRunConditionCount(playbookID, runID)
	}

	return s.getConditions(fetchConditions, fetchCount, page, perPage)
}

// getConditions is a private helper that handles common pagination logic
func (s *conditionService) getConditions(
	fetchConditions func() ([]Condition, error),
	fetchCount func() (int, error),
	page, perPage int,
) (*GetConditionsResults, error) {
	conditions, err := fetchConditions()
	if err != nil {
		return nil, err
	}

	totalCount, err := fetchCount()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get total condition count")
	}

	// Calculate pagination info
	pageCount := (totalCount + perPage - 1) / perPage
	if pageCount == 0 {
		pageCount = 1
	}

	hasMore := (page+1)*perPage < totalCount

	return &GetConditionsResults{
		TotalCount: totalCount,
		PageCount:  pageCount,
		HasMore:    hasMore,
		Items:      conditions,
	}, nil
}

func (s *conditionService) sendConditionCreatedWS(condition *Condition, teamID string) error {
	s.poster.PublishWebsocketEventToTeam(conditionCreatedWSEvent, condition, teamID)
	return nil
}

func (s *conditionService) sendConditionUpdatedWS(condition *Condition, teamID string) error {
	s.poster.PublishWebsocketEventToTeam(conditionUpdatedWSEvent, condition, teamID)
	return nil
}

func (s *conditionService) sendConditionDeletedWS(condition *Condition, teamID string) error {
	s.poster.PublishWebsocketEventToTeam(conditionDeletedWSEvent, condition, teamID)
	return nil
}
