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

type Condition struct {
	And []Condition `json:"and,omitempty"`
	Or  []Condition `json:"or,omitempty"`

	Is    *ComparisonCondition `json:"is,omitempty"`
	IsNot *ComparisonCondition `json:"isNot,omitempty"`
}

type ComparisonCondition struct {
	FieldID string          `json:"field_id"`
	Value   json.RawMessage `json:"value"`
}

// Evaluate checks if the condition matches the given property fields and values
func (c *Condition) Evaluate(propertyFields []PropertyField, propertyValues []PropertyValue) bool {
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
func (c *Condition) Validate(propertyFields []PropertyField) error {
	return c.validate(0, propertyFields)
}

// Sanitize trims whitespace from condition values
func (c *Condition) Sanitize() {
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

func (c *Condition) evaluate(fieldMap map[string]PropertyField, valueMap map[string]PropertyValue) bool {
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

func (c *Condition) validate(currentDepth int, propertyFields []PropertyField) error {
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
