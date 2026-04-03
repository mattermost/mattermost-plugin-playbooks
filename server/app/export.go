// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"reflect"

	"github.com/mattermost/mattermost/server/public/model"
)

const CurrentPlaybookExportVersion = 1

func getFieldsForExport(in interface{}) map[string]interface{} {
	out := map[string]interface{}{}

	inType := reflect.TypeOf(in)
	inValue := reflect.ValueOf(in)
	for i := 0; i < inType.NumField(); i++ {
		field := inType.Field(i)
		tag := field.Tag.Get("export")
		fieldValue := inValue.Field(i)
		if tag != "" && tag != "-" && !fieldValue.IsZero() {
			out[tag] = fieldValue.Interface()
		}
	}

	return out
}

func generateChecklistItemExport(checklistItems []ChecklistItem) []interface{} {
	exported := make([]interface{}, 0, len(checklistItems))
	for _, item := range checklistItems {
		exportItem := getFieldsForExport(item)
		exported = append(exported, exportItem)
	}

	return exported
}

func generateChecklistExport(checklists []Checklist) []interface{} {
	exported := make([]interface{}, 0, len(checklists))
	for _, checklist := range checklists {
		exportList := getFieldsForExport(checklist)
		exportList["items"] = generateChecklistItemExport(checklist.Items)
		exported = append(exported, exportList)
	}

	return exported
}

func generateMetricsExport(metrics []PlaybookMetricConfig) []interface{} {
	exported := make([]interface{}, 0, len(metrics))
	for _, checklist := range metrics {
		exportList := getFieldsForExport(checklist)
		exported = append(exported, exportList)
	}

	return exported
}

// ExportPropertyField represents a property field in export format
type ExportPropertyField struct {
	ID    string                  `json:"id"`
	Name  string                  `json:"name"`
	Type  model.PropertyFieldType `json:"type"`
	Attrs Attrs                   `json:"attrs"`
}

// ExportCondition represents a condition in export format
type ExportCondition struct {
	ID            string              `json:"id"`
	ConditionExpr ConditionExpression `json:"condition_expr"`
	Version       int                 `json:"version"`
}

// UnmarshalJSON deserializes ExportCondition from JSON.
// Since ConditionExpression is an interface, we need custom unmarshaling to properly
// deserialize condition_expr based on the version field.
func (ec *ExportCondition) UnmarshalJSON(data []byte) error {
	type Alias ExportCondition
	aux := &struct {
		ConditionExpr json.RawMessage `json:"condition_expr"`
		*Alias
	}{
		Alias: (*Alias)(ec),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	// Handle versioned condition expression deserialization
	if aux.ConditionExpr == nil || string(aux.ConditionExpr) == "null" {
		return nil // condition_expr is optional on export
	}

	switch ec.Version {
	case 1:
		var exprV1 ConditionExprV1
		if err := json.Unmarshal(aux.ConditionExpr, &exprV1); err != nil {
			return err
		}
		ec.ConditionExpr = &exprV1
	default:
		// Silently ignore unsupported versions during import (graceful degradation)
		return nil
	}

	return nil
}

// NewExportPropertyField creates an ExportPropertyField from a PropertyField
func NewExportPropertyField(pf PropertyField) ExportPropertyField {
	return ExportPropertyField{
		ID:    pf.ID,
		Name:  pf.Name,
		Type:  pf.Type,
		Attrs: pf.Attrs,
	}
}

// NewExportCondition creates an ExportCondition from a Condition
func NewExportCondition(c Condition) ExportCondition {
	return ExportCondition{
		ID:            c.ID,
		ConditionExpr: c.ConditionExpr,
		Version:       c.Version,
	}
}

func generatePropertiesExport(properties []PropertyField) []interface{} {
	exported := make([]interface{}, 0, len(properties))
	for _, property := range properties {
		exportProperty := NewExportPropertyField(property)
		exported = append(exported, exportProperty)
	}
	return exported
}

func generateConditionsExport(conditions []Condition) []interface{} {
	exported := make([]interface{}, 0, len(conditions))
	for _, condition := range conditions {
		exportCondition := NewExportCondition(condition)
		exported = append(exported, exportCondition)
	}
	return exported
}

// GeneratePlaybookExport returns a playbook in export format.
// Fields marked with the stuct tag "export" are included using the given string.
// If properties and conditions are provided, they are also included in the export.
// Note: CurrentPlaybookExportVersion is kept at 1 to maintain backward compatibility.
// This is intentional and safe because:
// - Added "properties" and "conditions" keys are purely additive
// - Go's json.Decoder silently ignores unknown keys on import
// - Servers with old export versions will gracefully degrade (importing without attributes/conditionals)
// - This avoids hard "Unsupported version" rejections for new exports
func GeneratePlaybookExport(playbook Playbook, properties []PropertyField, conditions []Condition) ([]byte, error) {
	export := getFieldsForExport(playbook)
	export["version"] = CurrentPlaybookExportVersion
	export["checklists"] = generateChecklistExport(playbook.Checklists)
	export["metrics"] = generateMetricsExport(playbook.Metrics)

	// Add properties and conditions if provided
	if len(properties) > 0 {
		export["properties"] = generatePropertiesExport(properties)
	}
	if len(conditions) > 0 {
		export["conditions"] = generateConditionsExport(conditions)
	}

	result, err := json.MarshalIndent(export, "", "    ")
	if err != nil {
		return nil, err
	}

	return result, nil
}
