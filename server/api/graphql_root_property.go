// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type PropertyRootResolver struct{}

// requirePlaybookAttributes returns an error if the playbook attributes feature is not licensed.
func requirePlaybookAttributes(c *GraphQLContext) error {
	if !c.licenceChecker.PlaybookAttributesAllowed() {
		return classifyAppError(errors.Wrapf(app.ErrLicensedFeature, "playbook attributes feature is not covered by current server license"))
	}
	return nil
}

// authorisePlaybookEdit fetches the playbook, checks edit permissions, and rejects archived playbooks.
func authorisePlaybookEdit(c *GraphQLContext, userID, playbookID string) (app.Playbook, error) {
	playbook, err := c.playbookService.Get(playbookID)
	if err != nil {
		return app.Playbook{}, classifyAppError(err)
	}
	if err := c.permissions.PlaybookEdit(userID, playbook); err != nil {
		return app.Playbook{}, classifyAppError(err)
	}
	if playbook.DeleteAt != 0 {
		return app.Playbook{}, classifyAppError(app.ErrPlaybookArchived)
	}
	return playbook, nil
}

// validatePropertyFieldOwnership returns an error if the field does not belong to the given playbook.
func validatePropertyFieldOwnership(field *app.PropertyField, playbookID string) error {
	if field.TargetID != playbookID {
		return newGraphQLError(errors.New("property field does not belong to the specified playbook"))
	}
	return nil
}

func (r *PropertyRootResolver) PlaybookProperty(ctx context.Context, args struct {
	PlaybookID string
	PropertyID string
}) (*PropertyFieldResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}

	if err := requirePlaybookAttributes(c); err != nil {
		return nil, err
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	if !model.IsValidId(args.PlaybookID) {
		return nil, newGraphQLError(errors.New("invalid playbook ID"))
	}
	if !model.IsValidId(args.PropertyID) {
		return nil, newGraphQLError(errors.New("invalid property ID"))
	}

	// Check permissions to view the playbook
	if err := c.permissions.PlaybookView(userID, args.PlaybookID); err != nil {
		return nil, err
	}

	// Get the property field using the service
	propertyField, err := c.propertyService.GetPropertyField(args.PropertyID)
	if err != nil {
		return nil, classifyAppError(err)
	}
	if propertyField == nil {
		return nil, classifyAppError(app.ErrNotFound)
	}

	// Verify the property field belongs to the specified playbook
	if err := validatePropertyFieldOwnership(propertyField, args.PlaybookID); err != nil {
		return nil, err
	}

	return &PropertyFieldResolver{propertyField: *propertyField}, nil
}

func (r *PropertyRootResolver) AddPlaybookPropertyField(ctx context.Context, args struct {
	PlaybookID    string
	PropertyField PropertyFieldGraphQLInput
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}

	if err := requirePlaybookAttributes(c); err != nil {
		return "", err
	}

	if !model.IsValidId(args.PlaybookID) {
		return "", newGraphQLError(errors.New("invalid playbook ID"))
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	if _, err := authorisePlaybookEdit(c, userID, args.PlaybookID); err != nil {
		return "", err
	}

	// Convert GraphQL input to PropertyField
	propertyField := convertPropertyFieldGraphQLInputToPropertyField(args.PropertyField)

	// Create the property field using the playbook service
	createdField, err := c.playbookService.CreatePropertyField(args.PlaybookID, *propertyField)
	if err != nil {
		return "", classifyAppError(err)
	}

	return createdField.ID, nil
}

func (r *PropertyRootResolver) UpdatePlaybookPropertyField(ctx context.Context, args struct {
	PlaybookID      string
	PropertyFieldID string
	PropertyField   PropertyFieldGraphQLInput
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}

	if err := requirePlaybookAttributes(c); err != nil {
		return "", err
	}

	if !model.IsValidId(args.PlaybookID) {
		return "", newGraphQLError(errors.New("invalid playbook ID"))
	}

	if !model.IsValidId(args.PropertyFieldID) {
		return "", newGraphQLError(errors.New("invalid property field ID"))
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	if _, err := authorisePlaybookEdit(c, userID, args.PlaybookID); err != nil {
		return "", err
	}

	// Get the existing property field to ensure it exists and belongs to this playbook
	existingField, err := c.propertyService.GetPropertyField(args.PropertyFieldID)
	if err != nil {
		return "", classifyAppError(err)
	}
	if existingField == nil {
		return "", classifyAppError(app.ErrNotFound)
	}

	// Verify the property field belongs to the specified playbook
	if err := validatePropertyFieldOwnership(existingField, args.PlaybookID); err != nil {
		return "", err
	}

	// Convert GraphQL input to PropertyField
	propertyField := convertPropertyFieldGraphQLInputToPropertyField(args.PropertyField)
	propertyField.ID = args.PropertyFieldID

	// Update the property field using the playbook service
	updatedField, err := c.playbookService.UpdatePropertyField(args.PlaybookID, *propertyField)
	if err != nil {
		return "", classifyAppError(err)
	}

	return updatedField.ID, nil
}

func (r *PropertyRootResolver) DeletePlaybookPropertyField(ctx context.Context, args struct {
	PlaybookID      string
	PropertyFieldID string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}

	if err := requirePlaybookAttributes(c); err != nil {
		return "", err
	}

	if !model.IsValidId(args.PlaybookID) {
		return "", newGraphQLError(errors.New("invalid playbook ID"))
	}

	if !model.IsValidId(args.PropertyFieldID) {
		return "", newGraphQLError(errors.New("invalid property field ID"))
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	playbook, err := authorisePlaybookEdit(c, userID, args.PlaybookID)
	if err != nil {
		return "", err
	}

	// Get the existing property field to ensure it exists and belongs to this playbook
	existingField, err := c.propertyService.GetPropertyField(args.PropertyFieldID)
	if err != nil {
		return "", classifyAppError(err)
	}
	if existingField == nil {
		return "", classifyAppError(app.ErrNotFound)
	}

	// Verify the property field belongs to the specified playbook
	if err := validatePropertyFieldOwnership(existingField, args.PlaybookID); err != nil {
		return "", err
	}

	// Guard: reject deletion if the field is still referenced in the channel name template.
	if playbook.ChannelNameTemplate != "" {
		allFields, err := c.propertyService.GetPropertyFields(args.PlaybookID)
		if err != nil {
			return "", classifyAppError(err)
		}
		if err := app.ValidateTemplateAfterFieldDeletion(playbook.ChannelNameTemplate, args.PropertyFieldID, allFields); err != nil {
			return "", newGraphQLError(err)
		}
	}

	// Delete the property field using the playbook service
	err = c.playbookService.DeletePropertyField(args.PlaybookID, args.PropertyFieldID)
	if err != nil {
		return "", classifyAppError(err)
	}

	return args.PropertyFieldID, nil
}

func (r *PropertyRootResolver) SetRunPropertyValue(ctx context.Context, args struct {
	RunID           string
	PropertyFieldID string
	Value           *JSONResolver
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}

	if err := requirePlaybookAttributes(c); err != nil {
		return "", err
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	// Extract the json.RawMessage from the JSONResolver
	var value json.RawMessage
	if args.Value != nil {
		value = args.Value.value
	} else {
		value = json.RawMessage(`null`)
	}

	if !model.IsValidId(args.RunID) {
		return "", newGraphQLError(errors.New("invalid run ID"))
	}

	if !model.IsValidId(args.PropertyFieldID) {
		return "", newGraphQLError(errors.New("invalid property field ID"))
	}

	// Coarse byte-size guard: the authoritative rune-count check is in the service layer.
	// Use 4x multiplier to account for multi-byte UTF-8 and JSON encoding overhead.
	if len(value) > 4*app.MaxPropertyValueLength {
		return "", newGraphQLError(errors.Errorf("property value exceeds maximum size of %d characters", app.MaxPropertyValueLength))
	}

	if err := c.permissions.RunManageProperties(userID, args.RunID); err != nil {
		return "", classifyAppError(err)
	}

	propertyValue, err := c.playbookRunService.SetRunPropertyValue(userID, args.RunID, args.PropertyFieldID, value)
	if err != nil {
		return "", classifyAppError(err)
	}

	return propertyValue.ID, nil
}

// convertPropertyFieldGraphQLInputToPropertyField converts a GraphQL PropertyFieldGraphQLInput to an app.PropertyField
func convertPropertyFieldGraphQLInputToPropertyField(input PropertyFieldGraphQLInput) *app.PropertyField {
	propertyField := &app.PropertyField{
		PropertyField: model.PropertyField{
			Name: input.Name,
			Type: input.Type,
		},
	}

	// Set default attrs if not provided
	if input.Attrs != nil {
		attrs := app.Attrs{}

		if input.Attrs.Visibility != nil {
			attrs.Visibility = *input.Attrs.Visibility
		} else {
			attrs.Visibility = app.PropertyFieldVisibilityDefault
		}

		if input.Attrs.SortOrder != nil {
			attrs.SortOrder = *input.Attrs.SortOrder
		}

		if input.Attrs.Options != nil {
			options := make(model.PropertyOptions[*model.PluginPropertyOption], 0, len(*input.Attrs.Options))
			for _, opt := range *input.Attrs.Options {
				var id string
				if opt.ID != nil {
					id = *opt.ID
				}
				option := model.NewPluginPropertyOption(id, opt.Name)
				if opt.Color != nil {
					option.SetValue("color", *opt.Color)
				}
				options = append(options, option)
			}
			attrs.Options = options
		}

		if input.Attrs.ParentID != nil {
			attrs.ParentID = *input.Attrs.ParentID
		}

		if input.Attrs.ValueType != nil {
			attrs.ValueType = *input.Attrs.ValueType
		}

		propertyField.Attrs = attrs
	} else {
		propertyField.Attrs = app.Attrs{
			Visibility: app.PropertyFieldVisibilityDefault,
		}
	}

	return propertyField
}
