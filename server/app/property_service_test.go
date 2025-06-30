// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestPropertyService_duplicatePropertyFieldForRun(t *testing.T) {
	s := &propertyService{}
	runID := model.NewId()
	playbookID := model.NewId()

	t.Run("text field with name and type only", func(t *testing.T) {
		playbookProperty := &model.PropertyField{
			ID:         model.NewId(),
			Name:       "Test Field",
			Type:       model.PropertyFieldTypeText,
			TargetType: PropertyTargetTypePlaybook,
			TargetID:   playbookID,
			Attrs: model.StringInterface{
				PropertyAttrsVisibility: PropertyFieldVisibilityDefault,
			},
		}

		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		require.NoError(t, err)

		require.NotEqual(t, playbookProperty.ID, runProperty.ID)
		require.Equal(t, playbookProperty.Name, runProperty.Name)
		require.Equal(t, playbookProperty.Type, runProperty.Type)
		require.Equal(t, PropertyTargetTypeRun, runProperty.TargetType)
		require.Equal(t, runID, runProperty.TargetID)
		require.Equal(t, playbookProperty.ID, runProperty.Attrs[PropertyAttrsParentID])
	})

	t.Run("text field with name, type and sort order", func(t *testing.T) {
		sortOrder := 42.5
		playbookProperty := &model.PropertyField{
			ID:         model.NewId(),
			Name:       "Test Field with Sort",
			Type:       model.PropertyFieldTypeText,
			TargetType: PropertyTargetTypePlaybook,
			TargetID:   playbookID,
			Attrs: model.StringInterface{
				PropertyAttrsVisibility: PropertyFieldVisibilityDefault,
				PropertyAttrsSortOrder:  sortOrder,
			},
		}

		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		require.NoError(t, err)

		require.NotEqual(t, playbookProperty.ID, runProperty.ID)
		require.Equal(t, playbookProperty.Name, runProperty.Name)
		require.Equal(t, playbookProperty.Type, runProperty.Type)
		require.Equal(t, PropertyTargetTypeRun, runProperty.TargetType)
		require.Equal(t, runID, runProperty.TargetID)
		require.Equal(t, playbookProperty.ID, runProperty.Attrs[PropertyAttrsParentID])
		require.Equal(t, sortOrder, runProperty.Attrs[PropertyAttrsSortOrder])
	})

	t.Run("select field with options and sort order", func(t *testing.T) {
		sortOrder := 10.0
		originalOptions := model.PropertyOptions[*model.PluginPropertyOption]{
			model.NewPluginPropertyOption(model.NewId(), "Option One"),
			model.NewPluginPropertyOption(model.NewId(), "Option Two"),
		}

		playbookProperty := &model.PropertyField{
			ID:         model.NewId(),
			Name:       "Test Select Field",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: PropertyTargetTypePlaybook,
			TargetID:   playbookID,
			Attrs: model.StringInterface{
				PropertyAttrsVisibility:             PropertyFieldVisibilityDefault,
				PropertyAttrsSortOrder:              sortOrder,
				model.PropertyFieldAttributeOptions: originalOptions,
			},
		}

		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		require.NoError(t, err)

		require.NotEqual(t, playbookProperty.ID, runProperty.ID)
		require.Equal(t, playbookProperty.Name, runProperty.Name)
		require.Equal(t, playbookProperty.Type, runProperty.Type)
		require.Equal(t, PropertyTargetTypeRun, runProperty.TargetType)
		require.Equal(t, runID, runProperty.TargetID)
		require.Equal(t, playbookProperty.ID, runProperty.Attrs[PropertyAttrsParentID])
		require.Equal(t, sortOrder, runProperty.Attrs[PropertyAttrsSortOrder])

		runOptions, ok := runProperty.Attrs[model.PropertyFieldAttributeOptions].(model.PropertyOptions[*model.PluginPropertyOption])
		require.True(t, ok)
		require.Len(t, runOptions, 2)

		require.Equal(t, originalOptions[0].GetName(), runOptions[0].GetName())
		require.Equal(t, originalOptions[1].GetName(), runOptions[1].GetName())

		require.NotEqual(t, originalOptions[0].GetID(), runOptions[0].GetID())
		require.NotEqual(t, originalOptions[1].GetID(), runOptions[1].GetID())
		require.NotEqual(t, runOptions[0].GetID(), runOptions[1].GetID())
		require.NotEmpty(t, runOptions[0].GetID())
		require.NotEmpty(t, runOptions[1].GetID())
	})
}
