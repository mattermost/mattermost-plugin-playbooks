// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"

	"github.com/pkg/errors"
)

// ChecklistItemCreateOptions specifies the parameters for IncidentsService.CreateChecklistItem method.
type ChecklistItemCreateOptions struct {
	Title string `json:"title"`
}

// ChecklistItemUpdateOptions specifies the parameters for IncidentsService.UpdateChecklistItem method.
type ChecklistItemUpdateOptions struct {
	Title *string `json:"title"`
}

// ChecklistItemListOptions specifies the optional parameters to the
// IncidentsService.ListChecklistItems method.
type ChecklistItemListOptions struct {
	ListOptions
}

// ChecklistItemList contains the paginated result.
type ChecklistItemList struct {
	ListResult
	Items []*ChecklistItem
}

// CreateChecklistItem creates a checklist item for this incident.
func (s *IncidentsService) CreateChecklistItem(ctx context.Context, incidentID, checklistIndex string, opts ChecklistCreateOptions) (*ChecklistItem, error) {
	return nil, errors.New("not implemented")
}

// GetChecklistItem gets a checklist item for this incident.
func (s *IncidentsService) GetChecklistItem(ctx context.Context, incidentID, checklistIndex, checklistItemIndex string) (*ChecklistItem, error) {
	return nil, errors.New("not implemented")
}

// UpdateChecklistItem updates a checklist item for this incident.
func (s *IncidentsService) UpdateChecklistItem(ctx context.Context, incidentID, checklistIndex, checklistItemIndex string, opts ChecklistUpdateOptions) (*ChecklistItem, error) {
	return nil, errors.New("not implemented")
}

// ListChecklistItems returns checklist items for this incident.
func (s *IncidentsService) ListChecklistItems(ctx context.Context, incidentID, checklistIndex string, opts ChecklistListOptions) (*ChecklistItemList, error) {
	return nil, errors.New("not implemented")
}

// DeleteChecklistItem deletes a checklist item for this incident.
func (s *IncidentsService) DeleteChecklistItem(ctx context.Context, incidentID, checklistIndex, checklistItemIndex string) (*ChecklistItem, error) {
	return nil, errors.New("not implemented")
}
