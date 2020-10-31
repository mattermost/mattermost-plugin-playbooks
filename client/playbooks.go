// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"
)

// Playbook represents a playbook.
type Playbook struct {
	ID         string      `json:"id"`
	Title      string      `json:"title"`
	Checklists []Checklist `json:"checklists"`
	TeamID     string      `json:"team_id"`
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
	Name   string `json:"name"`
	TeamID string `json:"team_id"`
	UserID string `json:"user_id"`
}

// PlaybookUpdateOptions specifies the parameters for PlaybooksService.Update method.
type PlaybookUpdateOptions struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	TeamID string `json:"team_id"`
	UserID string `json:"user_id"`
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

// NewPlaybooksService creates a new playbooks service
func NewPlaybooksService(client *Client) PlaybooksService {
	return PlaybooksService{client: client}
}

// Create an playbook.
func (s *PlaybooksService) Create(ctx context.Context, opts PlaybookCreateOptions) (*Playbook, error) {
	url := "playbooks"
	playbookRequest := Playbook{
		Title:  opts.Name,
		TeamID: opts.TeamID,
	}
	req, err := s.client.NewRequest(http.MethodPost, url, playbookRequest)
	if err != nil {
		return nil, err
	}

	p := new(Playbook)
	req.Header.Add("Mattermost-User-ID", opts.UserID)
	_, err = s.client.Do(ctx, req, p)
	if err != nil {
		return nil, err
	}

	return p, nil
}

// Get a playbook.
func (s *PlaybooksService) Get(ctx context.Context, playbookID string) (*Playbook, error) {
	url := fmt.Sprintf("%s/%s", "playbooks", playbookID)
	req, err := s.client.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	p := new(Playbook)
	_, err = s.client.Do(ctx, req, p)
	if err != nil {
		return nil, err
	}

	return p, nil
}

// Update a playbook.
func (s *PlaybooksService) Update(ctx context.Context, opts PlaybookUpdateOptions) (*Playbook, error) {
	url := fmt.Sprintf("%s/%s", "playbooks", opts.ID)
	playbookRequest := Playbook{
		Title:  opts.Name,
		TeamID: opts.TeamID,
	}
	req, err := s.client.NewRequest(http.MethodPost, url, playbookRequest)
	if err != nil {
		return nil, err
	}

	req.Header.Add("Mattermost-User-ID", opts.UserID)
	_, err = s.client.Do(ctx, req, nil)
	if err != nil {
		return nil, err
	}

	return nil, nil
}

// List the playbooks.
func (s *PlaybooksService) List(ctx context.Context, opt PlaybookListOptions) (*PlaybookList, error) {
	url := "playbooks"
	url, err := addOptions(url, opt)
	if err != nil {
		return nil, err
	}

	req, err := s.client.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	result := &PlaybookList{}
	_, err = s.client.Do(ctx, req, result)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// Delete a playbook.
func (s *PlaybooksService) Delete(ctx context.Context, playbookID string) (*Playbook, error) {
	url := fmt.Sprintf("%s/%s", "playbooks", playbookID)
	req, err := s.client.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return nil, err
	}

	_, err = s.client.Do(ctx, req, nil)
	if err != nil {
		return nil, err
	}

	return nil, nil
}
