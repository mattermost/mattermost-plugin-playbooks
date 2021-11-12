// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"
)

// PlaybooksService handles communication with the playbook related
// methods of the Playbook API.
type PlaybooksService struct {
	client *Client
}

// Get a playbook.
func (s *PlaybooksService) Get(ctx context.Context, playbookID string) (*Playbook, error) {
	playbookURL := fmt.Sprintf("playbooks/%s", playbookID)
	req, err := s.client.newRequest(http.MethodGet, playbookURL, nil)
	if err != nil {
		return nil, err
	}

	playbook := new(Playbook)
	resp, err := s.client.do(ctx, req, playbook)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return playbook, nil
}

// List the playbooks.
func (s *PlaybooksService) List(ctx context.Context, teamId string, page, perPage int, opts PlaybookListOptions) (*GetPlaybooksResults, error) {
	playbookURL := "playbooks"
	playbookURL, err := addOption(playbookURL, "team_id", teamId)
	if err != nil {
		return nil, fmt.Errorf("failed to build options: %w", err)
	}

	playbookURL, err = addPaginationOptions(playbookURL, page, perPage)
	if err != nil {
		return nil, fmt.Errorf("failed to build pagination options: %w", err)
	}

	playbookURL, err = addOptions(playbookURL, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to build options: %w", err)
	}

	req, err := s.client.newRequest(http.MethodGet, playbookURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	result := &GetPlaybooksResults{}
	resp, err := s.client.do(ctx, req, result)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	resp.Body.Close()

	return result, nil
}

// Create a playbook. Returns the id of the newly created playbook
func (s *PlaybooksService) Create(ctx context.Context, opts PlaybookCreateOptions) (string, error) {
	// For ease of use set the default if not specificed so it doesn't just error
	if opts.ReminderTimerDefaultSeconds == 0 {
		opts.ReminderTimerDefaultSeconds = 86400
	}

	playbookURL := "playbooks"
	req, err := s.client.newRequest(http.MethodPost, playbookURL, opts)
	if err != nil {
		return "", err
	}

	var result struct {
		ID string `json:"id"`
	}
	resp, err := s.client.do(ctx, req, &result)
	if err != nil {
		return "", err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("expected status code %d", http.StatusCreated)
	}

	return result.ID, nil
}

func (s *PlaybooksService) Update(ctx context.Context, playbook Playbook) error {
	updateURL := fmt.Sprintf("playbooks/%s", playbook.ID)
	req, err := s.client.newRequest(http.MethodPut, updateURL, playbook)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	return nil
}

func (s *PlaybooksService) Archive(ctx context.Context, playbookID string) error {
	updateURL := fmt.Sprintf("playbooks/%s", playbookID)
	req, err := s.client.newRequest(http.MethodDelete, updateURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	return nil
}
