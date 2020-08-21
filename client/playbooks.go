// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"

	"github.com/pkg/errors"
)

// Playbook represents a playbook.
type Playbook struct {
	ID         string      `json:"id"`
	Title      string      `json:"title"`
	Checklists []Checklist `json:"checklists"`
}

// Checklist represents a playbook's checklist.
type Checklist struct {
	ID    string          `json:"id"`
	Title string          `json:"title"`
	Items []ChecklistItem `json:"items"`
}

// ChecklistItem represents an item in a checklist.
type ChecklistItem struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	State string `json:"state"`
}

// PlaybookCreateOptions specifies the parameters for PlaybooksService.Create method.
type PlaybookCreateOptions struct {
	Name string `json:"name"`
}

// PlaybookUpdateOptions specifies the parameters for PlaybooksService.Update method.
type PlaybookUpdateOptions struct {
	Name *string `json:"name"`
}

// PlaybookListOptions specifies the optional parameters to the
// PlaybooksService.List method.
type PlaybookListOptions struct {
	ListOptions
}

// PlaybookList contains the paginated result.
type PlaybookList struct {
	ListResult
	Playbooks []*Playbook
}

// PlaybooksService handles communication with the playbook related
// methods of the workflows API.
type PlaybooksService struct {
	client *Client
}

// Create an playbook.
func (s *PlaybooksService) Create(ctx context.Context, opts PlaybookCreateOptions) (*Playbook, error) {
	return nil, errors.New("not implemented")
}

// Get a playbook.
func (s *PlaybooksService) Get(ctx context.Context, playbookID string) (*Playbook, error) {
	return nil, errors.New("not implemented")
}

// Update a playbook.
func (s *PlaybooksService) Update(ctx context.Context, opts PlaybookUpdateOptions) (*Playbook, error) {
	return nil, errors.New("not implemented")
}

// List the playbooks.
func (s *PlaybooksService) List(ctx context.Context, opt PlaybookListOptions) (*PlaybookList, error) {
	return nil, errors.New("not implemented")
}

// Delete a playbook.
func (s *PlaybooksService) Delete(ctx context.Context, playbookID string) (*Playbook, error) {
	return nil, errors.New("not implemented")
}
