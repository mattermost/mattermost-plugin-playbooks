// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

const (
	PropertyGroupPlaybooks = "playbooks"
	PropertySearchPerPage  = 20
)

type propertyService struct {
	api     *pluginapi.Client
	groupID string
}

func NewPropertyService(api *pluginapi.Client) (PropertyService, error) {
	service := &propertyService{
		api: api,
	}

	// Get or create the property group
	groupID, err := service.ensurePropertyGroup()
	if err != nil {
		return nil, errors.Wrap(err, "failed to ensure property group")
	}
	service.groupID = groupID

	return service, nil
}

func (s *propertyService) CreatePropertyField(playbookID string, propertyField PropertyField) (*PropertyField, error) {
	if err := propertyField.SanitizeAndValidate(); err != nil {
		return nil, errors.Wrap(err, "invalid property field")
	}

	mmPropertyField := propertyField.ToMattermostPropertyField()
	mmPropertyField.GroupID = s.groupID
	mmPropertyField.TargetType = PropertyTargetTypePlaybook
	mmPropertyField.TargetID = playbookID

	createdField, err := s.api.Property.CreatePropertyField(mmPropertyField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create property field")
	}

	resultField, err := NewPropertyFieldFromMattermostPropertyField(createdField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert created property field")
	}

	return resultField, nil
}

func (s *propertyService) GetPropertyField(propertyID string) (*PropertyField, error) {
	mmPropertyField, err := s.api.Property.GetPropertyField(s.groupID, propertyID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property field")
	}

	resultField, err := NewPropertyFieldFromMattermostPropertyField(mmPropertyField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert property field")
	}

	return resultField, nil
}

func (s *propertyService) GetPropertyFields(playbookID string) ([]PropertyField, error) {
	mmPropertyFields, err := s.getAllPropertyFields(PropertyTargetTypePlaybook, playbookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property fields")
	}

	propertyFields := make([]PropertyField, 0, len(mmPropertyFields))
	for _, mmField := range mmPropertyFields {
		propertyField, err := NewPropertyFieldFromMattermostPropertyField(mmField)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert property field")
		}
		propertyFields = append(propertyFields, *propertyField)
	}

	return propertyFields, nil
}

func (s *propertyService) GetRunPropertyFields(runID string) ([]PropertyField, error) {
	mmPropertyFields, err := s.getAllPropertyFields(PropertyTargetTypeRun, runID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get run property fields")
	}

	propertyFields := make([]PropertyField, 0, len(mmPropertyFields))
	for _, mmField := range mmPropertyFields {
		propertyField, err := NewPropertyFieldFromMattermostPropertyField(mmField)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert run property field")
		}
		propertyFields = append(propertyFields, *propertyField)
	}

	return propertyFields, nil
}

func (s *propertyService) UpdatePropertyField(playbookID string, propertyField PropertyField) (*PropertyField, error) {
	if err := propertyField.SanitizeAndValidate(); err != nil {
		return nil, errors.Wrap(err, "invalid property field")
	}

	// Get the existing property field to preserve timestamps and other fields
	existingField, err := s.api.Property.GetPropertyField(s.groupID, propertyField.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get existing property field")
	}

	// Convert the input to Mattermost property field
	mmPropertyField := propertyField.ToMattermostPropertyField()

	// Preserve important fields from the existing property field
	mmPropertyField.GroupID = existingField.GroupID
	mmPropertyField.TargetType = existingField.TargetType
	mmPropertyField.TargetID = existingField.TargetID
	mmPropertyField.CreateAt = existingField.CreateAt
	mmPropertyField.UpdateAt = existingField.UpdateAt
	mmPropertyField.DeleteAt = existingField.DeleteAt

	updatedField, err := s.api.Property.UpdatePropertyField(s.groupID, mmPropertyField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update property field")
	}

	resultField, err := NewPropertyFieldFromMattermostPropertyField(updatedField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert updated property field")
	}

	return resultField, nil
}

func (s *propertyService) DeletePropertyField(propertyID string) error {
	err := s.api.Property.DeletePropertyField(s.groupID, propertyID)
	if err != nil {
		return errors.Wrap(err, "failed to delete property field")
	}

	return nil
}

func (s *propertyService) getAllPropertyFields(targetType, targetID string) ([]*model.PropertyField, error) {
	opts := model.PropertyFieldSearchOpts{
		GroupID:    s.groupID,
		TargetType: targetType,
		TargetID:   targetID,
		PerPage:    PropertySearchPerPage,
	}

	var allFields []*model.PropertyField
	for {
		fields, err := s.api.Property.SearchPropertyFields(s.groupID, targetID, opts)
		if err != nil {
			return nil, errors.Wrap(err, "failed to search property fields")
		}

		allFields = append(allFields, fields...)

		if len(fields) < PropertySearchPerPage {
			break
		}

		lastField := fields[len(fields)-1]
		opts.Cursor = model.PropertyFieldSearchCursor{
			PropertyFieldID: lastField.ID,
			CreateAt:        lastField.CreateAt,
		}
	}

	return allFields, nil
}

func (s *propertyService) CopyPlaybookPropertiesToRun(playbookID, runID string) error {
	playbookProperties, err := s.getAllPropertyFields(PropertyTargetTypePlaybook, playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to get playbook properties")
	}

	for _, playbookProperty := range playbookProperties {
		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		if err != nil {
			return errors.Wrapf(err, "failed to duplicate property field %s for run", playbookProperty.Name)
		}

		_, err = s.api.Property.CreatePropertyField(runProperty)
		if err != nil {
			return errors.Wrapf(err, "failed to create run property field for %s", playbookProperty.Name)
		}
	}

	logrus.WithFields(logrus.Fields{
		"playbook_id":   playbookID,
		"run_id":        runID,
		"fields_copied": len(playbookProperties),
	}).Info("copied playbook properties to run")

	return nil
}

func (s *propertyService) copyPropertyFieldForRun(playbookProperty *model.PropertyField, runID string) (*model.PropertyField, error) {
	propertyField, err := NewPropertyFieldFromMattermostPropertyField(playbookProperty)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to convert playbook property %s", playbookProperty.Name)
	}

	propertyField.ID = ""
	propertyField.TargetType = PropertyTargetTypeRun
	propertyField.TargetID = runID
	propertyField.Attrs.ParentID = playbookProperty.ID

	if propertyField.SupportsOptions() {
		for i := range propertyField.Attrs.Options {
			propertyField.Attrs.Options[i].SetID("")
		}
	}

	if err := propertyField.SanitizeAndValidate(); err != nil {
		return nil, errors.Wrapf(err, "failed to validate run property field for %s", playbookProperty.Name)
	}

	return propertyField.ToMattermostPropertyField(), nil
}

func (s *propertyService) GetRunPropertyValues(runID string) ([]PropertyValue, error) {
	opts := model.PropertyValueSearchOpts{
		GroupID:    s.groupID,
		TargetType: PropertyTargetTypeRun,
		TargetID:   runID,
		PerPage:    PropertySearchPerPage,
	}

	var allValues []PropertyValue
	for {
		values, err := s.api.Property.SearchPropertyValues(s.groupID, runID, opts)
		if err != nil {
			return nil, errors.Wrap(err, "failed to search property values")
		}

		for _, mmValue := range values {
			allValues = append(allValues, PropertyValue(*mmValue))
		}

		if len(values) < PropertySearchPerPage {
			break
		}

		lastValue := values[len(values)-1]
		opts.Cursor = model.PropertyValueSearchCursor{
			PropertyValueID: lastValue.ID,
			CreateAt:        lastValue.CreateAt,
		}
	}

	return allValues, nil
}

func (s *propertyService) UpsertRunPropertyValue(runID, propertyFieldID string, value json.RawMessage) (*PropertyValue, error) {
	// Get the property field to validate against
	propertyField, err := s.api.Property.GetPropertyField(s.groupID, propertyFieldID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property field")
	}

	// Validate the value based on field type
	if err := s.validatePropertyValue(propertyField, value); err != nil {
		return nil, errors.Wrap(err, "invalid property value")
	}

	// Create the property value model
	propertyValue := &model.PropertyValue{
		GroupID:    s.groupID,
		FieldID:    propertyFieldID,
		TargetID:   runID,
		TargetType: PropertyTargetTypeRun,
		Value:      value,
	}

	// Use the plugin API to upsert the property value
	upsertedValue, err := s.api.Property.UpsertPropertyValue(propertyValue)
	if err != nil {
		return nil, errors.Wrap(err, "failed to upsert property value")
	}

	// Convert back to our PropertyValue type
	return (*PropertyValue)(upsertedValue), nil
}

func (s *propertyService) validatePropertyValue(propertyField *model.PropertyField, value json.RawMessage) error {
	switch propertyField.Type {
	case model.PropertyFieldTypeText:
		return s.validateTextValue(value)
	case model.PropertyFieldTypeSelect:
		return s.validateSelectValue(propertyField, value)
	case model.PropertyFieldTypeMultiselect:
		return s.validateMultiselectValue(propertyField, value)
	default:
		return errors.Errorf("property field type '%s' is not supported", propertyField.Type)
	}
}

func (s *propertyService) validateTextValue(value json.RawMessage) error {
	// Handle null/empty values - these are allowed for text fields
	if len(value) == 0 || string(value) == "null" {
		return nil
	}

	var stringValue string
	if err := json.Unmarshal(value, &stringValue); err != nil {
		return errors.New("text field value must be a string")
	}
	// Text values can be any string, including empty strings
	return nil
}

func (s *propertyService) validateSelectValue(propertyField *model.PropertyField, value json.RawMessage) error {
	// Handle null/empty values - these are allowed for select fields
	if len(value) == 0 || string(value) == "null" {
		return nil
	}

	var stringValue string
	if err := json.Unmarshal(value, &stringValue); err != nil {
		return errors.New("select field value must be a string")
	}

	// Convert to our PropertyField type to access parsed options
	ourPropertyField, err := NewPropertyFieldFromMattermostPropertyField(propertyField)
	if err != nil {
		return errors.Wrap(err, "failed to convert property field")
	}

	// Check if the value exists in the options
	for _, option := range ourPropertyField.Attrs.Options {
		if option.GetID() == stringValue {
			return nil
		}
	}

	return errors.New("select field value must be a valid option ID")
}

func (s *propertyService) validateMultiselectValue(propertyField *model.PropertyField, value json.RawMessage) error {
	// Handle null/empty values - these are allowed for multiselect fields
	if len(value) == 0 || string(value) == "null" {
		return nil
	}

	var arrayValue []string
	if err := json.Unmarshal(value, &arrayValue); err != nil {
		return errors.New("multiselect field value must be an array of strings")
	}

	// Empty arrays are allowed
	if len(arrayValue) == 0 {
		return nil
	}

	// Convert to our PropertyField type to access parsed options
	ourPropertyField, err := NewPropertyFieldFromMattermostPropertyField(propertyField)
	if err != nil {
		return errors.Wrap(err, "failed to convert property field")
	}

	// Build a map of valid option IDs for quick lookup
	validOptions := make(map[string]bool)
	for _, option := range ourPropertyField.Attrs.Options {
		validOptions[option.GetID()] = true
	}

	// Check that each value exists in the options
	for _, val := range arrayValue {
		if !validOptions[val] {
			return errors.Errorf("multiselect field value '%s' is not a valid option ID", val)
		}
	}

	return nil
}

func (s *propertyService) ensurePropertyGroup() (string, error) {
	registeredGroup, err := s.api.Property.RegisterPropertyGroup(PropertyGroupPlaybooks)
	if err != nil {
		return "", errors.Wrap(err, "failed to register property group")
	}

	return registeredGroup.ID, nil
}
