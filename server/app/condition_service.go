// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

type conditionService struct {
	store           ConditionStore
	propertyService PropertyService
}

func NewConditionService(store ConditionStore, propertyService PropertyService) ConditionService {
	return &conditionService{
		store:           store,
		propertyService: propertyService,
	}
}

// Create creates a new stored condition
func (s *conditionService) Create(userID string, condition Condition) (*Condition, error) {
	propertyFields, err := s.propertyService.GetPropertyFields(condition.PlaybookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property fields for validation")
	}

	// Set metadata for creation
	if condition.ID != "" {
		return nil, errors.New("condition ID should not be specified for creation")
	}
	condition.ID = model.NewId()

	now := model.GetMillis()
	condition.CreateAt = now
	condition.UpdateAt = now

	if err := condition.IsValid(true, propertyFields); err != nil {
		return nil, err
	}

	if condition.RunID != "" {
		return nil, errors.New("cannot create conditions with RunID - run conditions are system managed")
	}

	condition.ConditionExpr.Sanitize()

	createdCondition, err := s.store.CreateCondition(condition.PlaybookID, condition)
	if err != nil {
		return nil, err
	}

	return createdCondition, nil
}

// Get retrieves a stored condition by ID
func (s *conditionService) Get(userID, playbookID, conditionID string) (*Condition, error) {
	condition, err := s.store.GetCondition(playbookID, conditionID)
	if err != nil {
		return nil, err
	}
	return condition, nil
}

// Update updates an existing stored condition
func (s *conditionService) Update(userID string, condition Condition) (*Condition, error) {
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

	return updatedCondition, nil
}

// Delete soft-deletes a stored condition
func (s *conditionService) Delete(userID, playbookID, conditionID string) error {
	existing, err := s.store.GetCondition(playbookID, conditionID)
	if err != nil {
		return err
	}

	if existing.RunID != "" {
		return errors.New("cannot delete conditions associated with a run - run conditions are read-only")
	}

	return s.store.DeleteCondition(playbookID, conditionID)
}

// GetConditions retrieves stored conditions with filtering
func (s *conditionService) GetConditions(userID, playbookID string, options ConditionFilterOptions) ([]Condition, error) {
	conditions, err := s.store.GetConditions(playbookID, options)
	if err != nil {
		return nil, err
	}

	return conditions, nil
}
