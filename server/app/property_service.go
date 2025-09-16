// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

const (
	PropertyGroupPlaybooks    = "playbooks"
	PropertySearchPerPage     = 20
	PropertyBulkSearchPerPage = 1000
	MaxPropertiesPerPlaybook  = 20
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

	// Check if adding a new property would exceed the limit
	if err := s.validatePropertyLimit(playbookID); err != nil {
		return nil, err
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

// validatePropertyLimit checks if adding a new property would exceed the maximum allowed
func (s *propertyService) validatePropertyLimit(playbookID string) error {
	currentCount, err := s.GetPropertyFieldsCount(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to get current property count")
	}

	if currentCount >= MaxPropertiesPerPlaybook {
		return errors.Errorf("cannot create property field: playbook already has the maximum allowed number of properties (%d)", MaxPropertiesPerPlaybook)
	}

	return nil
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

func (s *propertyService) GetPropertyFieldsCount(playbookID string) (int, error) {
	count, err := s.api.Property.CountPropertyFieldsForTarget(
		s.groupID,
		PropertyTargetTypePlaybook,
		playbookID,
		false, // only count active (non-deleted) properties
	)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count property fields for playbook")
	}
	return int(count), nil
}

func (s *propertyService) GetRunPropertyFields(runID string) ([]PropertyField, error) {
	fieldsMap, err := s.getRunsPropertyFields([]string{runID}, PropertySearchPerPage)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get run property fields")
	}

	if fields, exists := fieldsMap[runID]; exists {
		return fields, nil
	}

	return []PropertyField{}, nil
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
		TargetIDs:  []string{targetID},
		PerPage:    PropertySearchPerPage,
	}

	var allFields []*model.PropertyField
	for {
		fields, err := s.api.Property.SearchPropertyFields(s.groupID, opts)
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

	sort.Slice(allFields, func(i, j int) bool {
		return PropertySortOrder(allFields[i]) < PropertySortOrder(allFields[j])
	})

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
	valuesMap, err := s.getRunsPropertyValues([]string{runID}, PropertySearchPerPage)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get run property values")
	}

	if values, exists := valuesMap[runID]; exists {
		return values, nil
	}

	return []PropertyValue{}, nil
}

func (s *propertyService) GetRunPropertyValueByFieldID(runID, propertyFieldID string) (*PropertyValue, error) {
	opts := model.PropertyValueSearchOpts{
		GroupID:    s.groupID,
		TargetType: PropertyTargetTypeRun,
		TargetIDs:  []string{runID},
		FieldID:    propertyFieldID,
		PerPage:    1,
	}

	values, err := s.api.Property.SearchPropertyValues(s.groupID, opts)
	if err != nil {
		return nil, errors.Wrap(err, "failed to search property value")
	}

	if len(values) == 0 {
		return nil, nil
	}

	propertyValue := PropertyValue(*values[0])
	return &propertyValue, nil
}

func (s *propertyService) UpsertRunPropertyValue(runID, propertyFieldID string, value json.RawMessage) (*PropertyValue, error) {
	// Get the property field to validate against
	propertyField, err := s.api.Property.GetPropertyField(s.groupID, propertyFieldID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property field")
	}

	// Sanitize and validate the value based on field type
	sanitizedValue, err := s.sanitizeAndValidatePropertyValue(propertyField, value)
	if err != nil {
		return nil, errors.Wrap(err, "failed to sanitize and validate property value")
	}

	// Create the property value model
	propertyValue := &model.PropertyValue{
		GroupID:    s.groupID,
		FieldID:    propertyFieldID,
		TargetID:   runID,
		TargetType: PropertyTargetTypeRun,
		Value:      sanitizedValue,
	}

	// Use the plugin API to upsert the property value
	upsertedValue, err := s.api.Property.UpsertPropertyValue(propertyValue)
	if err != nil {
		return nil, errors.Wrap(err, "failed to upsert property value")
	}

	// Convert back to our PropertyValue type
	return (*PropertyValue)(upsertedValue), nil
}

func (s *propertyService) sanitizeAndValidatePropertyValue(propertyField *model.PropertyField, value json.RawMessage) (json.RawMessage, error) {
	if len(value) == 0 || string(value) == "null" {
		return value, nil
	}

	switch propertyField.Type {
	case model.PropertyFieldTypeText:
		var stringValue string
		if err := json.Unmarshal(value, &stringValue); err != nil {
			return nil, errors.New("text field value must be a string")
		}
		sanitizedString, err := s.sanitizeTextValue(stringValue)
		if err != nil {
			return nil, err
		}
		return json.Marshal(sanitizedString)
	case model.PropertyFieldTypeSelect:
		var stringValue string
		if err := json.Unmarshal(value, &stringValue); err != nil {
			return nil, errors.New("select field value must be a string")
		}
		return value, s.validateSelectValue(propertyField, stringValue)
	case model.PropertyFieldTypeMultiselect:
		var arrayValue []string
		if err := json.Unmarshal(value, &arrayValue); err != nil {
			return nil, errors.New("multiselect field value must be an array of strings")
		}
		return value, s.validateMultiselectValue(propertyField, arrayValue)
	default:
		return nil, errors.Errorf("property field type '%s' is not supported", propertyField.Type)
	}
}

func (s *propertyService) sanitizeTextValue(value string) (string, error) {
	return strings.TrimSpace(value), nil
}

func (s *propertyService) validateSelectValue(propertyField *model.PropertyField, value string) error {
	if value == "" {
		return nil
	}

	pf, err := NewPropertyFieldFromMattermostPropertyField(propertyField)
	if err != nil {
		return errors.Wrap(err, "failed to convert property field")
	}

	for _, option := range pf.Attrs.Options {
		if option.GetID() == value {
			return nil
		}
	}

	return errors.New("select field value must be a valid option ID")
}

func (s *propertyService) validateMultiselectValue(propertyField *model.PropertyField, value []string) error {
	if len(value) == 0 {
		return nil
	}

	pf, err := NewPropertyFieldFromMattermostPropertyField(propertyField)
	if err != nil {
		return errors.Wrap(err, "failed to convert property field")
	}

	validOptions := make(map[string]struct{})
	for _, option := range pf.Attrs.Options {
		validOptions[option.GetID()] = struct{}{}
	}

	for _, val := range value {
		if _, exists := validOptions[val]; !exists {
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

// GetRunsPropertyFields retrieves all property fields for multiple runs efficiently
func (s *propertyService) GetRunsPropertyFields(runIDs []string) (map[string][]PropertyField, error) {
	return s.getRunsPropertyFields(runIDs, PropertyBulkSearchPerPage)
}

// GetRunsPropertyValues retrieves all property values for multiple runs efficiently
func (s *propertyService) GetRunsPropertyValues(runIDs []string) (map[string][]PropertyValue, error) {
	return s.getRunsPropertyValues(runIDs, PropertyBulkSearchPerPage)
}

// getRunsPropertyFields handles property field retrieval in a paginated way
func (s *propertyService) getRunsPropertyFields(runIDs []string, pageSize int) (map[string][]PropertyField, error) {
	if len(runIDs) == 0 {
		return make(map[string][]PropertyField), nil
	}

	opts := model.PropertyFieldSearchOpts{
		GroupID:    s.groupID,
		TargetType: PropertyTargetTypeRun,
		TargetIDs:  runIDs,
		PerPage:    pageSize,
	}

	result := make(map[string][]PropertyField)

	var allFields []*model.PropertyField
	for {
		fields, err := s.api.Property.SearchPropertyFields(s.groupID, opts)
		if err != nil {
			return nil, errors.Wrap(err, "failed to search property fields")
		}

		allFields = append(allFields, fields...)

		if len(fields) < pageSize {
			break
		}

		opts.Cursor.PropertyFieldID = fields[len(fields)-1].ID
		opts.Cursor.CreateAt = fields[len(fields)-1].CreateAt
	}

	for _, mmField := range allFields {
		pf, err := NewPropertyFieldFromMattermostPropertyField(mmField)
		if err != nil {
			logrus.WithError(err).Warn("Failed to convert property field")
			continue
		}
		result[mmField.TargetID] = append(result[mmField.TargetID], *pf)
	}

	return result, nil
}

// getRunsPropertyValues handles property value retrieval in a paginated way
func (s *propertyService) getRunsPropertyValues(runIDs []string, pageSize int) (map[string][]PropertyValue, error) {
	if len(runIDs) == 0 {
		return make(map[string][]PropertyValue), nil
	}

	opts := model.PropertyValueSearchOpts{
		GroupID:    s.groupID,
		TargetType: PropertyTargetTypeRun,
		TargetIDs:  runIDs,
		PerPage:    pageSize,
	}

	result := make(map[string][]PropertyValue)

	var allValues []*model.PropertyValue
	for {
		values, err := s.api.Property.SearchPropertyValues(s.groupID, opts)
		if err != nil {
			return nil, errors.Wrap(err, "failed to search property values")
		}

		allValues = append(allValues, values...)

		if len(values) < pageSize {
			break
		}

		opts.Cursor.PropertyValueID = values[len(values)-1].ID
		opts.Cursor.CreateAt = values[len(values)-1].CreateAt
	}

	for _, mmValue := range allValues {
		pv := PropertyValue(*mmValue)
		result[mmValue.TargetID] = append(result[mmValue.TargetID], pv)
	}

	return result, nil
}
