// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"

	"github.com/pkg/errors"
)

// Step represents an incident's step.
type Step struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// StepCreateOptions specifies the parameters for IncidentsService.CreateStep method.
type StepCreateOptions struct {
	Title string `json:"title"`
}

// StepUpdateOptions specifies the parameters for IncidentsService.UpdateStep method.
type StepUpdateOptions struct {
	Title *string `json:"title"`
}

// StepListOptions specifies the optional parameters to the
// IncidentsService.ListSteps method.
type StepListOptions struct {
	ListOptions
}

// StepList contains the paginated result.
type StepList struct {
	ListResult
	Items []*Step
}

// CreateStep creates a step.
func (s *IncidentsService) CreateStep(ctx context.Context, incidentID string, opts StepCreateOptions) (*Step, error) {
	return nil, errors.New("not implemented")
}

// GetStep gets a step.
func (s *IncidentsService) GetStep(ctx context.Context, stepID string) (*Step, error) {
	return nil, errors.New("not implemented")
}

// UpdateStep updates a step.
func (s *IncidentsService) UpdateStep(ctx context.Context, stepID string, opts StepUpdateOptions) (*Step, error) {
	return nil, errors.New("not implemented")
}

// ListSteps returns steps of an incident incident.
func (s *IncidentsService) ListSteps(ctx context.Context, incidentID string, opts StepListOptions) (*StepList, error) {
	return nil, errors.New("not implemented")
}

// DeleteStep deletes a step.
func (s *IncidentsService) DeleteStep(ctx context.Context, stepID string) (*Step, error) {
	return nil, errors.New("not implemented")
}
