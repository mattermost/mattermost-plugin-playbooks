// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"

	"github.com/pkg/errors"
)

// ChecklistCreateOptions specifies the parameters for IncidentsService.CreateChecklist method.
type ChecklistCreateOptions struct {
	Title string `json:"title"`
}

// ChecklistUpdateOptions specifies the parameters for IncidentsService.UpdateChecklist method.
type ChecklistUpdateOptions struct {
	Title *string `json:"title"`
}

// ChecklistListOptions specifies the optional parameters to the
// IncidentsService.ListChecklists method.
type ChecklistListOptions struct {
	ListOptions
}

// ChecklistList contains the paginated result.
type ChecklistList struct {
	ListResult
	Items []*Checklist
}

// CreateChecklist creates a checklist for this incident.
func (s *IncidentsService) CreateChecklist(ctx context.Context, incidentID string, opts ChecklistCreateOptions) (*Checklist, error) {
	return nil, errors.New("not implemented")
}

// GetChecklist gets a checklist for this incident.
func (s *IncidentsService) GetChecklist(ctx context.Context, incidentID, checklistIndex string) (*Checklist, error) {
	return nil, errors.New("not implemented")
}

// UpdateChecklist updates a checklist for this incident.
func (s *IncidentsService) UpdateChecklist(ctx context.Context, incidentID, checklistIndex string, opts ChecklistUpdateOptions) (*Checklist, error) {
	return nil, errors.New("not implemented")
}

// ListChecklists returns checklists for this incident.
func (s *IncidentsService) ListChecklists(ctx context.Context, incidentID string, opts ChecklistListOptions) (*ChecklistList, error) {
	return nil, errors.New("not implemented")
}

// DeleteChecklist deletes a checklist for this incident.
func (s *IncidentsService) DeleteChecklist(ctx context.Context, incidentID, checklistIndex string) (*Checklist, error) {
	return nil, errors.New("not implemented")
}
