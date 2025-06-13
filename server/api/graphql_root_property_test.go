// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertPropertyFieldInputToPropertyField(t *testing.T) {
	t.Run("basic text field with minimal attrs", func(t *testing.T) {
		input := PropertyFieldInput{
			Name: "Test Field",
			Type: "text",
		}

		result := convertPropertyFieldInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, "Test Field", result.Name)
		assert.Equal(t, model.PropertyFieldType("text"), result.Type)
		assert.Equal(t, app.PropertyFieldVisibilityDefault, result.Attrs.Visibility)
		assert.Zero(t, result.Attrs.SortOrder)
		assert.Nil(t, result.Attrs.Options)
		assert.Empty(t, result.Attrs.ParentID)
	})

	t.Run("basic field with nil attrs", func(t *testing.T) {
		input := PropertyFieldInput{
			Name:  "Test Field",
			Type:  "text",
			Attrs: nil,
		}

		result := convertPropertyFieldInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, "Test Field", result.Name)
		assert.Equal(t, model.PropertyFieldType("text"), result.Type)
		assert.Equal(t, app.PropertyFieldVisibilityDefault, result.Attrs.Visibility)
		assert.Zero(t, result.Attrs.SortOrder)
		assert.Nil(t, result.Attrs.Options)
		assert.Empty(t, result.Attrs.ParentID)
	})

	t.Run("field with complete attrs", func(t *testing.T) {
		visibility := "always"
		sortOrder := 10.5
		parentID := "parent-123"

		input := PropertyFieldInput{
			Name: "Complete Field",
			Type: "select",
			Attrs: &PropertyFieldAttrsInput{
				Visibility: &visibility,
				SortOrder:  &sortOrder,
				ParentID:   &parentID,
			},
		}

		result := convertPropertyFieldInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, "Complete Field", result.Name)
		assert.Equal(t, model.PropertyFieldType("select"), result.Type)
		assert.Equal(t, "always", result.Attrs.Visibility)
		assert.Equal(t, 10.5, result.Attrs.SortOrder)
		assert.Equal(t, "parent-123", result.Attrs.ParentID)
	})

	t.Run("field with options without IDs", func(t *testing.T) {
		color1 := "red"
		color2 := "blue"
		options := []PropertyOptionInput{
			{
				Name:  "Option 1",
				Color: &color1,
			},
			{
				Name:  "Option 2",
				Color: &color2,
			},
		}

		input := PropertyFieldInput{
			Name: "Select Field",
			Type: "select",
			Attrs: &PropertyFieldAttrsInput{
				Options: &options,
			},
		}

		result := convertPropertyFieldInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, "Select Field", result.Name)
		assert.Equal(t, model.PropertyFieldType("select"), result.Type)
		require.Len(t, result.Attrs.Options, 2)

		option1 := result.Attrs.Options[0]
		assert.Equal(t, "Option 1", option1.GetName())
		assert.Empty(t, option1.GetID())
		assert.Equal(t, "red", option1.GetValue("color"))

		option2 := result.Attrs.Options[1]
		assert.Equal(t, "Option 2", option2.GetName())
		assert.Empty(t, option2.GetID())
		assert.Equal(t, "blue", option2.GetValue("color"))
	})

	t.Run("field with options with IDs", func(t *testing.T) {
		id1 := "opt-1"
		id2 := "opt-2"
		color1 := "green"
		options := []PropertyOptionInput{
			{
				ID:    &id1,
				Name:  "Existing Option 1",
				Color: &color1,
			},
			{
				ID:   &id2,
				Name: "Existing Option 2",
			},
		}

		input := PropertyFieldInput{
			Name: "Select Field",
			Type: "select",
			Attrs: &PropertyFieldAttrsInput{
				Options: &options,
			},
		}

		result := convertPropertyFieldInputToPropertyField(input)

		require.NotNil(t, result)
		require.Len(t, result.Attrs.Options, 2)

		option1 := result.Attrs.Options[0]
		assert.Equal(t, "Existing Option 1", option1.GetName())
		assert.Equal(t, "opt-1", option1.GetID())
		assert.Equal(t, "green", option1.GetValue("color"))

		option2 := result.Attrs.Options[1]
		assert.Equal(t, "Existing Option 2", option2.GetName())
		assert.Equal(t, "opt-2", option2.GetID())
		assert.Equal(t, "", option2.GetValue("color"))
	})

	t.Run("field with options without colors", func(t *testing.T) {
		options := []PropertyOptionInput{
			{
				Name: "Plain Option 1",
			},
			{
				Name: "Plain Option 2",
			},
		}

		input := PropertyFieldInput{
			Name: "Select Field",
			Type: "select",
			Attrs: &PropertyFieldAttrsInput{
				Options: &options,
			},
		}

		result := convertPropertyFieldInputToPropertyField(input)

		require.NotNil(t, result)
		require.Len(t, result.Attrs.Options, 2)

		option1 := result.Attrs.Options[0]
		assert.Equal(t, "Plain Option 1", option1.GetName())
		assert.Equal(t, "", option1.GetValue("color"))

		option2 := result.Attrs.Options[1]
		assert.Equal(t, "Plain Option 2", option2.GetName())
		assert.Equal(t, "", option2.GetValue("color"))
	})

	t.Run("field with empty options array", func(t *testing.T) {
		options := []PropertyOptionInput{}

		input := PropertyFieldInput{
			Name: "Select Field",
			Type: "select",
			Attrs: &PropertyFieldAttrsInput{
				Options: &options,
			},
		}

		result := convertPropertyFieldInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Empty(t, result.Attrs.Options)
	})

	t.Run("different field types", func(t *testing.T) {
		testCases := []struct {
			name         string
			fieldType    string
			expectedType model.PropertyFieldType
		}{
			{"text field", "text", model.PropertyFieldType("text")},
			{"number field", "number", model.PropertyFieldType("number")},
			{"select field", "select", model.PropertyFieldType("select")},
			{"date field", "date", model.PropertyFieldType("date")},
			{"checkbox field", "checkbox", model.PropertyFieldType("checkbox")},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				input := PropertyFieldInput{
					Name: "Test Field",
					Type: tc.fieldType,
				}

				result := convertPropertyFieldInputToPropertyField(input)

				require.NotNil(t, result)
				assert.Equal(t, tc.expectedType, result.Type)
			})
		}
	})

	t.Run("attrs with partial values", func(t *testing.T) {
		sortOrder := 5.0

		input := PropertyFieldInput{
			Name: "Partial Attrs Field",
			Type: "text",
			Attrs: &PropertyFieldAttrsInput{
				SortOrder: &sortOrder,
			},
		}

		result := convertPropertyFieldInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, app.PropertyFieldVisibilityDefault, result.Attrs.Visibility)
		assert.Equal(t, 5.0, result.Attrs.SortOrder)
		assert.Empty(t, result.Attrs.ParentID)
		assert.Nil(t, result.Attrs.Options)
	})

	t.Run("complex field with all attrs", func(t *testing.T) {
		visibility := "edit_only"
		sortOrder := 15.5
		parentID := "complex-parent"
		id1 := "complex-opt-1"
		color1 := "purple"
		color2 := "orange"

		options := []PropertyOptionInput{
			{
				ID:    &id1,
				Name:  "Complex Option 1",
				Color: &color1,
			},
			{
				Name:  "Complex Option 2",
				Color: &color2,
			},
		}

		input := PropertyFieldInput{
			Name: "Complex Field",
			Type: "multiselect",
			Attrs: &PropertyFieldAttrsInput{
				Visibility: &visibility,
				SortOrder:  &sortOrder,
				ParentID:   &parentID,
				Options:    &options,
			},
		}

		result := convertPropertyFieldInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, "Complex Field", result.Name)
		assert.Equal(t, model.PropertyFieldType("multiselect"), result.Type)
		assert.Equal(t, "edit_only", result.Attrs.Visibility)
		assert.Equal(t, 15.5, result.Attrs.SortOrder)
		assert.Equal(t, "complex-parent", result.Attrs.ParentID)
		require.Len(t, result.Attrs.Options, 2)

		option1 := result.Attrs.Options[0]
		assert.Equal(t, "Complex Option 1", option1.GetName())
		assert.Equal(t, "complex-opt-1", option1.GetID())
		assert.Equal(t, "purple", option1.GetValue("color"))

		option2 := result.Attrs.Options[1]
		assert.Equal(t, "Complex Option 2", option2.GetName())
		assert.Empty(t, option2.GetID())
		assert.Equal(t, "orange", option2.GetValue("color"))
	})

	t.Run("visibility constants", func(t *testing.T) {
		testCases := []struct {
			name       string
			visibility string
		}{
			{"hidden visibility", app.PropertyFieldVisibilityHidden},
			{"when_set visibility", app.PropertyFieldVisibilityWhenSet},
			{"always visibility", app.PropertyFieldVisibilityAlways},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				input := PropertyFieldInput{
					Name: "Test Field",
					Type: "text",
					Attrs: &PropertyFieldAttrsInput{
						Visibility: &tc.visibility,
					},
				}

				result := convertPropertyFieldInputToPropertyField(input)

				require.NotNil(t, result)
				assert.Equal(t, tc.visibility, result.Attrs.Visibility)
			})
		}
	})

	t.Run("edge cases", func(t *testing.T) {
		t.Run("empty field name", func(t *testing.T) {
			input := PropertyFieldInput{
				Name: "",
				Type: "text",
			}

			result := convertPropertyFieldInputToPropertyField(input)

			require.NotNil(t, result)
			assert.Equal(t, "", result.Name)
			assert.Equal(t, model.PropertyFieldType("text"), result.Type)
		})

		t.Run("empty field type", func(t *testing.T) {
			input := PropertyFieldInput{
				Name: "Test Field",
				Type: "",
			}

			result := convertPropertyFieldInputToPropertyField(input)

			require.NotNil(t, result)
			assert.Equal(t, "Test Field", result.Name)
			assert.Equal(t, model.PropertyFieldType(""), result.Type)
		})

		t.Run("zero sort order", func(t *testing.T) {
			sortOrder := 0.0

			input := PropertyFieldInput{
				Name: "Test Field",
				Type: "text",
				Attrs: &PropertyFieldAttrsInput{
					SortOrder: &sortOrder,
				},
			}

			result := convertPropertyFieldInputToPropertyField(input)

			require.NotNil(t, result)
			assert.Equal(t, 0.0, result.Attrs.SortOrder)
		})

		t.Run("negative sort order", func(t *testing.T) {
			sortOrder := -5.5

			input := PropertyFieldInput{
				Name: "Test Field",
				Type: "text",
				Attrs: &PropertyFieldAttrsInput{
					SortOrder: &sortOrder,
				},
			}

			result := convertPropertyFieldInputToPropertyField(input)

			require.NotNil(t, result)
			assert.Equal(t, -5.5, result.Attrs.SortOrder)
		})

		t.Run("empty parent ID", func(t *testing.T) {
			parentID := ""

			input := PropertyFieldInput{
				Name: "Test Field",
				Type: "text",
				Attrs: &PropertyFieldAttrsInput{
					ParentID: &parentID,
				},
			}

			result := convertPropertyFieldInputToPropertyField(input)

			require.NotNil(t, result)
			assert.Equal(t, "", result.Attrs.ParentID)
		})

		t.Run("option with empty name", func(t *testing.T) {
			options := []PropertyOptionInput{
				{
					Name: "",
				},
			}

			input := PropertyFieldInput{
				Name: "Select Field",
				Type: "select",
				Attrs: &PropertyFieldAttrsInput{
					Options: &options,
				},
			}

			result := convertPropertyFieldInputToPropertyField(input)

			require.NotNil(t, result)
			require.Len(t, result.Attrs.Options, 1)
			assert.Equal(t, "", result.Attrs.Options[0].GetName())
		})

		t.Run("option with empty ID", func(t *testing.T) {
			emptyID := ""
			options := []PropertyOptionInput{
				{
					ID:   &emptyID,
					Name: "Option with empty ID",
				},
			}

			input := PropertyFieldInput{
				Name: "Select Field",
				Type: "select",
				Attrs: &PropertyFieldAttrsInput{
					Options: &options,
				},
			}

			result := convertPropertyFieldInputToPropertyField(input)

			require.NotNil(t, result)
			require.Len(t, result.Attrs.Options, 1)
			assert.Equal(t, "", result.Attrs.Options[0].GetID())
		})

		t.Run("option with empty color", func(t *testing.T) {
			emptyColor := ""
			options := []PropertyOptionInput{
				{
					Name:  "Option with empty color",
					Color: &emptyColor,
				},
			}

			input := PropertyFieldInput{
				Name: "Select Field",
				Type: "select",
				Attrs: &PropertyFieldAttrsInput{
					Options: &options,
				},
			}

			result := convertPropertyFieldInputToPropertyField(input)

			require.NotNil(t, result)
			require.Len(t, result.Attrs.Options, 1)
			assert.Equal(t, "", result.Attrs.Options[0].GetValue("color"))
		})
	})
}