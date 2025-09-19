// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	MaxConditionDepth = 1 // Maximum nesting depth allowed for and/or conditions
)

type ConditionExpr struct {
	And []ConditionExpr `json:"and,omitempty"`
	Or  []ConditionExpr `json:"or,omitempty"`

	Is    *ComparisonCondition `json:"is,omitempty"`
	IsNot *ComparisonCondition `json:"isNot,omitempty"`
}

type ComparisonCondition struct {
	FieldID string          `json:"field_id"`
	Value   json.RawMessage `json:"value"`
}

// Evaluate checks if the condition matches the given property fields and values
func (c *ConditionExpr) Evaluate(propertyFields []PropertyField, propertyValues []PropertyValue) bool {
	// fieldID -> PropertyField
	fieldMap := make(map[string]PropertyField)
	for _, field := range propertyFields {
		fieldMap[field.ID] = field
	}

	// fieldID -> PropertyValue
	valueMap := make(map[string]PropertyValue)
	for _, value := range propertyValues {
		valueMap[value.FieldID] = value
	}

	return c.evaluate(fieldMap, valueMap)
}

// Validate ensures the condition is structurally valid and references valid field options
func (c *ConditionExpr) Validate(propertyFields []PropertyField) error {
	return c.validate(0, propertyFields)
}

// Sanitize trims whitespace from condition values
func (c *ConditionExpr) Sanitize() {
	if c.And != nil {
		for i := range c.And {
			c.And[i].Sanitize()
		}
	}

	if c.Or != nil {
		for i := range c.Or {
			c.Or[i].Sanitize()
		}
	}

	if c.Is != nil {
		c.Is.Sanitize()
	}

	if c.IsNot != nil {
		c.IsNot.Sanitize()
	}
}

func (c *ConditionExpr) evaluate(fieldMap map[string]PropertyField, valueMap map[string]PropertyValue) bool {
	if c.And != nil {
		for _, condition := range c.And {
			if !condition.evaluate(fieldMap, valueMap) {
				return false
			}
		}
		return true
	}

	if c.Or != nil {
		for _, condition := range c.Or {
			if condition.evaluate(fieldMap, valueMap) {
				return true
			}
		}
		return false
	}

	if c.Is != nil {
		field, fieldExists := fieldMap[c.Is.FieldID]
		if !fieldExists {
			return false
		}

		value, valueExists := valueMap[c.Is.FieldID]
		if !valueExists {
			return false
		}

		return is(field, value, c.Is.Value)
	}

	if c.IsNot != nil {
		field, fieldExists := fieldMap[c.IsNot.FieldID]
		if !fieldExists {
			return true
		}

		value, valueExists := valueMap[c.IsNot.FieldID]
		if !valueExists {
			return true
		}

		return isNot(field, value, c.IsNot.Value)
	}

	return true
}

func (c *ConditionExpr) validate(currentDepth int, propertyFields []PropertyField) error {
	conditionCount := 0

	if c.And != nil {
		conditionCount++
		if len(c.And) == 0 {
			return errors.New("and condition must have at least one nested condition")
		}
		if currentDepth >= MaxConditionDepth {
			return fmt.Errorf("condition nesting depth exceeds maximum allowed (%d)", MaxConditionDepth)
		}
		for _, condition := range c.And {
			if err := condition.validate(currentDepth+1, propertyFields); err != nil {
				return err
			}
		}
	}

	if c.Or != nil {
		conditionCount++
		if len(c.Or) == 0 {
			return errors.New("or condition must have at least one nested condition")
		}
		if currentDepth >= MaxConditionDepth {
			return fmt.Errorf("condition nesting depth exceeds maximum allowed (%d)", MaxConditionDepth)
		}
		for _, condition := range c.Or {
			if err := condition.validate(currentDepth+1, propertyFields); err != nil {
				return err
			}
		}
	}

	if c.Is != nil {
		conditionCount++
		if err := c.Is.Validate(propertyFields); err != nil {
			return err
		}
	}

	if c.IsNot != nil {
		conditionCount++
		if err := c.IsNot.Validate(propertyFields); err != nil {
			return err
		}
	}

	if conditionCount == 0 {
		return errors.New("condition must have at least one operation (and, or, is, isNot)")
	}

	if conditionCount > 1 {
		return errors.New("condition can only have one operation (and, or, is, isNot)")
	}

	return nil
}

// Validate ensures the comparison condition has valid field references and option values
func (cc *ComparisonCondition) Validate(propertyFields []PropertyField) error {
	if cc.FieldID == "" {
		return errors.New("field_id cannot be empty")
	}

	// Find the field to validate against
	for _, field := range propertyFields {
		if field.ID == cc.FieldID {
			return cc.validateValueForFieldType(field)
		}
	}

	return nil
}

// Sanitize trims whitespace from the comparison value
func (cc *ComparisonCondition) Sanitize() {
	var stringValue string
	if err := json.Unmarshal(cc.Value, &stringValue); err == nil {
		trimmed := strings.TrimSpace(stringValue)
		sanitized, _ := json.Marshal(trimmed)
		cc.Value = sanitized
	}
}

func (cc *ComparisonCondition) validateValueForFieldType(field PropertyField) error {
	switch field.Type {
	case model.PropertyFieldTypeText:
		var stringValue string
		if err := json.Unmarshal(cc.Value, &stringValue); err != nil {
			return errors.New("text field condition value must be a string")
		}
		return nil

	case model.PropertyFieldTypeSelect:
		var arrayValue []string
		if err := json.Unmarshal(cc.Value, &arrayValue); err != nil {
			return errors.New("select field condition value must be an array")
		}
		if len(arrayValue) == 0 {
			return errors.New("select field condition value array cannot be empty")
		}

		if len(field.Attrs.Options) == 0 {
			return errors.New("condition value does not match any valid option for select field")
		}

		validOptionIDs := make(map[string]bool)
		for _, option := range field.Attrs.Options {
			validOptionIDs[option.GetID()] = true
		}

		for _, value := range arrayValue {
			if !validOptionIDs[value] {
				return errors.New("condition value does not match any valid option for select field")
			}
		}

		return nil

	case model.PropertyFieldTypeMultiselect:
		var arrayValue []string
		if err := json.Unmarshal(cc.Value, &arrayValue); err != nil {
			return errors.New("multiselect field condition value must be an array")
		}
		if len(arrayValue) == 0 {
			return errors.New("multiselect field condition value array cannot be empty")
		}

		if len(field.Attrs.Options) == 0 {
			return errors.New("condition value does not match any valid option for multiselect field")
		}

		validOptionIDs := make(map[string]bool)
		for _, option := range field.Attrs.Options {
			validOptionIDs[option.GetID()] = true
		}

		for _, value := range arrayValue {
			if !validOptionIDs[value] {
				return errors.New("condition value does not match any valid option for multiselect field")
			}
		}

		return nil

	default:
		return errors.New("unsupported field type for condition")
	}
}

// is checks if a property value matches the condition value based on the field type.
// For text fields: condition value is a string, performs case-insensitive comparison using strings.EqualFold.
// For select fields: condition value is an array, checks if the property value is any of the condition values.
// For multiselect fields: condition value is an array, checks if any condition value is in the property array.
func is(propertyField PropertyField, propertyValue PropertyValue, conditionValue json.RawMessage) bool {
	if propertyValue.Value == nil {
		return false
	}

	switch propertyField.Type {
	case model.PropertyFieldTypeText:
		var conditionString string
		if err := json.Unmarshal(conditionValue, &conditionString); err != nil {
			return false
		}

		var propertyString string
		if err := json.Unmarshal(propertyValue.Value, &propertyString); err != nil {
			return false
		}

		return strings.EqualFold(propertyString, conditionString)

	case model.PropertyFieldTypeSelect:
		var conditionArray []string
		if err := json.Unmarshal(conditionValue, &conditionArray); err != nil {
			return false
		}

		var propertyString string
		if err := json.Unmarshal(propertyValue.Value, &propertyString); err != nil {
			return false
		}

		return slices.Contains(conditionArray, propertyString)

	case model.PropertyFieldTypeMultiselect:
		var conditionArray []string
		if err := json.Unmarshal(conditionValue, &conditionArray); err != nil {
			return false
		}

		var propertyArray []string
		if err := json.Unmarshal(propertyValue.Value, &propertyArray); err != nil {
			return false
		}

		for _, conditionItem := range conditionArray {
			if slices.Contains(propertyArray, conditionItem) {
				return true
			}
		}
		return false

	default:
		return false
	}
}

// isNot checks if a property value does NOT match any of the condition values based on the field type.
// It returns the logical negation of the is function result.
func isNot(propertyField PropertyField, propertyValue PropertyValue, conditionValue json.RawMessage) bool {
	return !is(propertyField, propertyValue, conditionValue)
}

// ToString returns a human-readable string representation of the condition
func (c *ConditionExpr) ToString(propertyFields []PropertyField) string {
	fieldMap := make(map[string]PropertyField)
	for _, field := range propertyFields {
		fieldMap[field.ID] = field
	}

	return c.toString(fieldMap, false)
}

func (c *ConditionExpr) toString(fieldMap map[string]PropertyField, needsParens bool) string {
	if c.And != nil {
		var parts []string
		for _, condition := range c.And {
			parts = append(parts, condition.toString(fieldMap, true))
		}
		if len(parts) == 1 {
			return parts[0]
		}
		result := strings.Join(parts, " AND ")
		if needsParens {
			return "(" + result + ")"
		}
		return result
	}

	if c.Or != nil {
		var parts []string
		for _, condition := range c.Or {
			parts = append(parts, condition.toString(fieldMap, true))
		}
		if len(parts) == 1 {
			return parts[0]
		}
		result := strings.Join(parts, " OR ")
		if needsParens {
			return "(" + result + ")"
		}
		return result
	}

	if c.Is != nil {
		return c.Is.toString(fieldMap, false)
	}

	if c.IsNot != nil {
		return c.IsNot.toString(fieldMap, true)
	}

	return ""
}

func (cc *ComparisonCondition) toString(fieldMap map[string]PropertyField, isNot bool) string {
	field, exists := fieldMap[cc.FieldID]
	var fieldName string
	if exists && field.Name != "" {
		fieldName = field.Name
	} else {
		fieldName = cc.FieldID
	}

	operator := "is"
	if isNot {
		operator = "is not"
	}

	valueStr := cc.formatValue(field, exists)
	return fmt.Sprintf("%s %s %s", fieldName, operator, valueStr)
}

func (cc *ComparisonCondition) formatValue(field PropertyField, fieldExists bool) string {
	if !fieldExists {
		return cc.formatUnknownFieldValue()
	}

	switch field.Type {
	case model.PropertyFieldTypeText:
		return cc.formatTextValue()
	case model.PropertyFieldTypeSelect:
		return cc.formatSelectValue(field)
	case model.PropertyFieldTypeMultiselect:
		return cc.formatMultiselectValue(field)
	}

	return ""
}

func (cc *ComparisonCondition) formatTextValue() string {
	var stringValue string
	if err := json.Unmarshal(cc.Value, &stringValue); err == nil {
		return stringValue
	}
	return string(cc.Value)
}

func (cc *ComparisonCondition) formatSelectValue(field PropertyField) string {
	var arrayValue []string
	if err := json.Unmarshal(cc.Value, &arrayValue); err != nil {
		return string(cc.Value)
	}

	optionMap := make(map[string]string)
	for _, option := range field.Attrs.Options {
		optionMap[option.GetID()] = option.GetName()
	}

	var displayValues []string
	for _, value := range arrayValue {
		if name, ok := optionMap[value]; ok {
			displayValues = append(displayValues, name)
		} else {
			displayValues = append(displayValues, value)
		}
	}

	if len(displayValues) == 1 {
		return displayValues[0]
	}
	return "[" + strings.Join(displayValues, ",") + "]"
}

func (cc *ComparisonCondition) formatMultiselectValue(field PropertyField) string {
	var arrayValue []string
	if err := json.Unmarshal(cc.Value, &arrayValue); err != nil {
		return string(cc.Value)
	}

	optionMap := make(map[string]string)
	for _, option := range field.Attrs.Options {
		optionMap[option.GetID()] = option.GetName()
	}

	var displayValues []string
	for _, value := range arrayValue {
		if name, ok := optionMap[value]; ok {
			displayValues = append(displayValues, name)
		} else {
			displayValues = append(displayValues, value)
		}
	}

	if len(displayValues) == 1 {
		return displayValues[0]
	}
	return "[" + strings.Join(displayValues, ",") + "]"
}

func (cc *ComparisonCondition) formatUnknownFieldValue() string {
	var stringValue string
	if err := json.Unmarshal(cc.Value, &stringValue); err == nil {
		return stringValue
	}

	var arrayValue []string
	if err := json.Unmarshal(cc.Value, &arrayValue); err == nil {
		if len(arrayValue) == 1 {
			return arrayValue[0]
		}
		return "[" + strings.Join(arrayValue, ",") + "]"
	}

	return string(cc.Value)
}

// Condition represents a condition in the public API
type Condition struct {
	ID            string        `json:"id"`
	ConditionExpr ConditionExpr `json:"condition_expr"`
	PlaybookID    string        `json:"playbook_id"`
	RunID         string        `json:"run_id,omitempty"`
	CreateAt      int64         `json:"create_at"`
	UpdateAt      int64         `json:"update_at"`
	DeleteAt      int64         `json:"delete_at"`
}

// StoredCondition represents a condition as stored in the database
type StoredCondition struct {
	Condition
	PropertyFieldIDs   []string `json:"property_field_ids"`
	PropertyOptionsIDs []string `json:"property_options_ids"`
}

// NewStoredCondition creates a StoredCondition from a public Condition
func NewStoredCondition(condition Condition) StoredCondition {
	return StoredCondition{
		Condition:          condition,
		PropertyFieldIDs:   extractPropertyFieldIDs(condition.ConditionExpr),
		PropertyOptionsIDs: extractPropertyOptionsIDs(condition.ConditionExpr),
	}
}

// IsValid validates a condition
func (c *Condition) IsValid(isCreation bool, propertyFields []PropertyField) error {
	if isCreation && c.ID != "" {
		return errors.New("condition ID should not be specified for creation")
	}

	if !isCreation && c.ID == "" {
		return errors.New("condition ID is required for updates")
	}

	if c.PlaybookID == "" {
		return errors.New("playbook ID is required")
	}

	// Run conditions are read-only - cannot be created, updated, or deleted via API
	if c.RunID != "" {
		if isCreation {
			return errors.New("run conditions cannot be created directly")
		} else {
			return errors.New("run conditions cannot be modified")
		}
	}

	// Validate the condition expression structure
	if err := c.ConditionExpr.Validate(propertyFields); err != nil {
		return fmt.Errorf("invalid condition expression: %w", err)
	}

	return nil
}

// ConditionFilterOptions provides filtering options for listing conditions
type ConditionFilterOptions struct {
	PlaybookID string
	RunID      string
	Page       int
	PerPage    int
}

// ConditionService provides methods for managing stored conditions
type ConditionService interface {
	Create(userID string, condition Condition) (*Condition, error)
	Get(userID, playbookID, conditionID string) (*Condition, error)
	Update(userID string, condition Condition) (*Condition, error)
	Delete(userID, playbookID, conditionID string) error
	GetConditions(userID, playbookID string, options ConditionFilterOptions) ([]Condition, error)
}

// ConditionStore defines database operations for stored conditions
type ConditionStore interface {
	CreateCondition(playbookID string, condition StoredCondition) (*StoredCondition, error)
	GetCondition(playbookID, conditionID string) (*StoredCondition, error)
	UpdateCondition(playbookID string, condition StoredCondition) (*StoredCondition, error)
	DeleteCondition(playbookID, conditionID string) error
	GetConditions(playbookID string, options ConditionFilterOptions) ([]StoredCondition, error)
}
