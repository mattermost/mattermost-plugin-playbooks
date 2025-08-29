// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"

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

	if err := condition.IsValid(true, propertyFields); err != nil {
		return nil, err
	}

	if condition.RunID != "" {
		return nil, errors.New("cannot create conditions with RunID - run conditions are system managed")
	}

	condition.ConditionExpr.Sanitize()

	storedCondition := NewStoredCondition(condition)

	createdStored, err := s.store.CreateCondition(condition.PlaybookID, storedCondition)
	if err != nil {
		return nil, err
	}

	return &createdStored.Condition, nil
}

// Get retrieves a stored condition by ID
func (s *conditionService) Get(userID, playbookID, conditionID string) (*Condition, error) {
	storedCondition, err := s.store.GetCondition(playbookID, conditionID)
	if err != nil {
		return nil, err
	}
	return &storedCondition.Condition, nil
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

	propertyFields, err := s.propertyService.GetPropertyFields(condition.PlaybookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property fields for validation")
	}

	if err := condition.IsValid(false, propertyFields); err != nil {
		return nil, err
	}

	condition.ConditionExpr.Sanitize()

	storedCondition := NewStoredCondition(condition)

	updatedStored, err := s.store.UpdateCondition(condition.PlaybookID, storedCondition)
	if err != nil {
		return nil, err
	}

	return &updatedStored.Condition, nil
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
	storedConditions, err := s.store.GetConditions(playbookID, options)
	if err != nil {
		return nil, err
	}

	conditions := make([]Condition, 0, len(storedConditions))
	for _, storedCondition := range storedConditions {
		conditions = append(conditions, storedCondition.Condition)
	}

	return conditions, nil
}

// extractPropertyFieldIDs recursively extracts all property field IDs from a condition
func extractPropertyFieldIDs(condition ConditionExpr) []string {
	var fieldIDs []string
	fieldIDSet := make(map[string]struct{})

	extractFromCondition(condition, fieldIDSet)

	for fieldID := range fieldIDSet {
		fieldIDs = append(fieldIDs, fieldID)
	}

	return fieldIDs
}

func extractFromCondition(condition ConditionExpr, fieldIDSet map[string]struct{}) {
	if condition.And != nil {
		for _, subCondition := range condition.And {
			extractFromCondition(subCondition, fieldIDSet)
		}
	}

	if condition.Or != nil {
		for _, subCondition := range condition.Or {
			extractFromCondition(subCondition, fieldIDSet)
		}
	}

	if condition.Is != nil {
		fieldIDSet[condition.Is.FieldID] = struct{}{}
	}

	if condition.IsNot != nil {
		fieldIDSet[condition.IsNot.FieldID] = struct{}{}
	}
}

// extractPropertyOptionsIDs recursively extracts all property options IDs from a condition
func extractPropertyOptionsIDs(condition ConditionExpr) []string {
	var optionsIDs []string
	optionsIDSet := make(map[string]struct{})

	extractOptionsFromCondition(condition, optionsIDSet)

	for optionsID := range optionsIDSet {
		optionsIDs = append(optionsIDs, optionsID)
	}

	return optionsIDs
}

func extractOptionsFromCondition(condition ConditionExpr, optionsIDSet map[string]struct{}) {
	if condition.And != nil {
		for _, subCondition := range condition.And {
			extractOptionsFromCondition(subCondition, optionsIDSet)
		}
	}

	if condition.Or != nil {
		for _, subCondition := range condition.Or {
			extractOptionsFromCondition(subCondition, optionsIDSet)
		}
	}

	if condition.Is != nil {
		extractOptionsFromComparison(condition.Is, optionsIDSet)
	}

	if condition.IsNot != nil {
		extractOptionsFromComparison(condition.IsNot, optionsIDSet)
	}
}

func extractOptionsFromComparison(comparison *ComparisonCondition, optionsIDSet map[string]struct{}) {
	var arrayValue []string
	if err := json.Unmarshal(comparison.Value, &arrayValue); err == nil {
		// Successfully unmarshaled as array (select/multiselect fields)
		for _, optionID := range arrayValue {
			optionsIDSet[optionID] = struct{}{}
		}
	}
}
