// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"gopkg.in/guregu/null.v4"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeneratePlaybookExport(t *testing.T) {
	pb := Playbook{
		Title:    "Testing",
		CreateAt: 23423234,
		Checklists: []Checklist{
			{
				Title: "checklist 1",
				Items: []ChecklistItem{
					{
						Title:       "This is an item",
						Description: "It's an item",
					},
				},
			},
		},
		Metrics: []PlaybookMetricConfig{
			{
				ID:          "1",
				PlaybookID:  "11",
				Title:       "Title 1",
				Description: "Description 1",
				Type:        MetricTypeCurrency,
				Target:      null.IntFrom(147),
			},
		},
	}

	output, err := GeneratePlaybookExport(pb, []PropertyField{}, []Condition{})
	require.NoError(t, err)

	result := Playbook{}
	err = json.Unmarshal(output, &result)
	require.NoError(t, err)

	// Should copy the specified stuff
	assert.Equal(t, result.Title, pb.Title)

	// Shouldn't copy the not specificed stuff
	assert.Equal(t, result.CreateAt, int64(0))

	// Shouldn't copy metrics ID and PlaybookID fields
	assert.NotEqual(t, result.Metrics, pb.Metrics)
	//After cleaning ID and PlaybookID, should be equal
	pb.Metrics[0].ID = ""
	pb.Metrics[0].PlaybookID = ""
	assert.Equal(t, result.Metrics, pb.Metrics)

}

func definesExports(t *testing.T, thing interface{}) {
	inType := reflect.TypeOf(thing)
	for i := 0; i < inType.NumField(); i++ {
		field := inType.Field(i)
		tag := strings.TrimSpace(field.Tag.Get("export"))
		if tag == "" {
			t.Errorf("%s struct does not define export for field %s. Please define this struct tag, see comment above playbook struct.", inType.Name(), field.Name)
		}
	}
}

func TestPlaybookDefinesExports(t *testing.T) {
	definesExports(t, Playbook{})
	definesExports(t, Checklist{})
	definesExports(t, ChecklistItem{})
}

func TestGeneratePlaybookExportWithProperties(t *testing.T) {
	// Create a test playbook with properties and conditions
	pb := Playbook{
		Title:    "Testing with Properties",
		CreateAt: 23423234,
		Checklists: []Checklist{
			{
				Title: "checklist 1",
				Items: []ChecklistItem{
					{
						Title:       "Conditional Item",
						Description: "Item with condition",
						ConditionID: "cond1",
					},
				},
			},
		},
	}

	// Create test properties
	properties := []PropertyField{
		{
			PropertyField: model.PropertyField{
				ID:   "prop1",
				Name: "Status",
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Visibility: PropertyFieldVisibilityAlways,
				SortOrder:  1,
			},
		},
	}

	// Create test conditions
	conditions := []Condition{
		{
			ID:      "cond1",
			Version: 1,
			ConditionExpr: &ConditionExprV1{
				Is: &ComparisonCondition{
					FieldID: "prop1",
					Value:   json.RawMessage(`["active"]`),
				},
			},
		},
	}

	output, err := GeneratePlaybookExport(pb, properties, conditions)
	require.NoError(t, err)

	// Unmarshal to verify structure
	var result map[string]interface{}
	err = json.Unmarshal(output, &result)
	require.NoError(t, err)

	// Verify properties are present
	props, ok := result["properties"].([]interface{})
	require.True(t, ok, "properties should be present in export")
	require.Len(t, props, 1)

	// Verify conditions are present
	conds, ok := result["conditions"].([]interface{})
	require.True(t, ok, "conditions should be present in export")
	require.Len(t, conds, 1)

	// Verify checklist item has condition ID
	checklists, ok := result["checklists"].([]interface{})
	require.True(t, ok, "checklists should be present in export")
	checklist := checklists[0].(map[string]interface{})
	items := checklist["items"].([]interface{})
	item := items[0].(map[string]interface{})
	assert.Equal(t, "cond1", item["condition_id"])
}

func TestExportConditionRoundTrip(t *testing.T) {
	original := ExportCondition{
		ID:      "cond1",
		Version: 1,
		ConditionExpr: &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "field1",
				Value:   json.RawMessage(`["opt1"]`),
			},
		},
	}
	data, err := json.Marshal(original)
	require.NoError(t, err)

	var decoded ExportCondition
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	require.NotNil(t, decoded.ConditionExpr)
	expr, ok := decoded.ConditionExpr.(*ConditionExprV1)
	require.True(t, ok, "should deserialize as *ConditionExprV1")
	assert.Equal(t, "field1", expr.Is.FieldID)
	assert.Equal(t, json.RawMessage(`["opt1"]`), expr.Is.Value)
	assert.Equal(t, 1, decoded.Version)
	assert.Equal(t, "cond1", decoded.ID)
}

func TestExportConditionUnmarshalUnsupportedVersion(t *testing.T) {
	data := []byte(`{"id":"c1","version":99,"condition_expr":{"is":{"field_id":"f1","value":"x"}}}`)
	var ec ExportCondition
	err := json.Unmarshal(data, &ec)
	require.NoError(t, err, "unsupported versions should not error")
	assert.Nil(t, ec.ConditionExpr, "unsupported version should leave ConditionExpr nil")
	assert.Equal(t, 99, ec.Version)
}

func TestExportConditionUnmarshalNullExpr(t *testing.T) {
	data := []byte(`{"id":"c1","version":1,"condition_expr":null}`)
	var ec ExportCondition
	err := json.Unmarshal(data, &ec)
	require.NoError(t, err)
	assert.Nil(t, ec.ConditionExpr)
}
