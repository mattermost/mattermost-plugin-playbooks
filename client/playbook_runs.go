// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"
)

// PlaybookRunService handles communication with the playbook run related
// methods of the Playbooks API.
type PlaybookRunService struct {
	client *Client
}

// Get a playbook run.
func (s *PlaybookRunService) Get(ctx context.Context, playbookRunID string) (*PlaybookRun, error) {
	playbookRunURL := fmt.Sprintf("runs/%s", playbookRunID)
	req, err := s.client.newRequest(http.MethodGet, playbookRunURL, nil)
	if err != nil {
		return nil, err
	}

	playbookRun := new(PlaybookRun)
	resp, err := s.client.do(ctx, req, playbookRun)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return playbookRun, nil
}

// GetByChannelID gets a playbook run by ChannelID.
func (s *PlaybookRunService) GetByChannelID(ctx context.Context, channelID string) (*PlaybookRun, error) {
	channelURL := fmt.Sprintf("runs/channel/%s", channelID)
	req, err := s.client.newRequest(http.MethodGet, channelURL, nil)
	if err != nil {
		return nil, err
	}

	playbookRun := new(PlaybookRun)
	resp, err := s.client.do(ctx, req, playbookRun)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return playbookRun, nil
}

// Get a playbook run's metadata.
func (s *PlaybookRunService) GetMetadata(ctx context.Context, playbookRunID string) (*PlaybookRunMetadata, error) {
	playbookRunURL := fmt.Sprintf("runs/%s/metadata", playbookRunID)
	req, err := s.client.newRequest(http.MethodGet, playbookRunURL, nil)
	if err != nil {
		return nil, err
	}

	playbookRun := new(PlaybookRunMetadata)
	resp, err := s.client.do(ctx, req, playbookRun)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return playbookRun, nil
}

// List the playbook runs.
func (s *PlaybookRunService) List(ctx context.Context, page, perPage int, opts PlaybookRunListOptions) (*GetPlaybookRunsResults, error) {
	playbookRunURL := "runs"
	playbookRunURL, err := addOptions(playbookRunURL, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to build options: %w", err)
	}
	playbookRunURL, err = addPaginationOptions(playbookRunURL, page, perPage)
	if err != nil {
		return nil, fmt.Errorf("failed to build pagination options: %w", err)
	}

	req, err := s.client.newRequest(http.MethodGet, playbookRunURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	result := &GetPlaybookRunsResults{}
	resp, err := s.client.do(ctx, req, result)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	resp.Body.Close()

	return result, nil
}

// Create a playbook run.
func (s *PlaybookRunService) Create(ctx context.Context, opts PlaybookRunCreateOptions) (*PlaybookRun, error) {
	playbookRunURL := "runs"
	req, err := s.client.newRequest(http.MethodPost, playbookRunURL, opts)
	if err != nil {
		return nil, err
	}

	playbookRun := new(PlaybookRun)
	resp, err := s.client.do(ctx, req, playbookRun)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("expected status code %d", http.StatusCreated)
	}

	return playbookRun, nil
}

func (s *PlaybookRunService) UpdateStatus(ctx context.Context, playbookRunID string, message string, reminderInSeconds int64) error {
	updateURL := fmt.Sprintf("runs/%s/status", playbookRunID)
	opts := StatusUpdateOptions{
		Message:           message,
		ReminderInSeconds: reminderInSeconds,
	}
	req, err := s.client.newRequest(http.MethodPost, updateURL, opts)
	if err != nil {
		return err
	}

	resp, err := s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expected status code %d", http.StatusOK)
	}

	return nil
}

func (s *PlaybookRunService) Finish(ctx context.Context, playbookRunID string) error {
	finishURL := fmt.Sprintf("runs/%s/finish", playbookRunID)
	req, err := s.client.newRequest(http.MethodPut, finishURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	return nil
}

func (s *PlaybookRunService) CreateChecklist(ctx context.Context, playbookRunID string, checklist Checklist) error {
	createURL := fmt.Sprintf("runs/%s/checklists", playbookRunID)
	req, err := s.client.newRequest(http.MethodPost, createURL, checklist)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) RemoveChecklist(ctx context.Context, playbookRunID string, checklistNumber int) error {
	createURL := fmt.Sprintf("runs/%s/checklists/%d", playbookRunID, checklistNumber)
	req, err := s.client.newRequest(http.MethodDelete, createURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) RenameChecklist(ctx context.Context, playbookRunID string, checklistNumber int, newTitle string) error {
	createURL := fmt.Sprintf("runs/%s/checklists/%d/rename", playbookRunID, checklistNumber)
	req, err := s.client.newRequest(http.MethodPut, createURL, struct{ Title string }{newTitle})
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) AddChecklistItem(ctx context.Context, playbookRunID string, checklistNumber int, checklistItem ChecklistItem) error {
	addURL := fmt.Sprintf("runs/%s/checklists/%d/add", playbookRunID, checklistNumber)
	req, err := s.client.newRequest(http.MethodPost, addURL, checklistItem)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) MoveChecklist(ctx context.Context, playbookRunID string, sourceChecklistIdx, destChecklistIdx int) error {
	createURL := fmt.Sprintf("runs/%s/checklists/move", playbookRunID)
	body := struct {
		SourceChecklistIdx int `json:"source_checklist_idx"`
		DestChecklistIdx   int `json:"dest_checklist_idx"`
	}{sourceChecklistIdx, destChecklistIdx}

	req, err := s.client.newRequest(http.MethodPost, createURL, body)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) MoveChecklistItem(ctx context.Context, playbookRunID string, sourceChecklistIdx, sourceItemIdx, destChecklistIdx, destItemIdx int) error {
	createURL := fmt.Sprintf("runs/%s/checklists/move-item", playbookRunID)
	body := struct {
		SourceChecklistIdx int `json:"source_checklist_idx"`
		SourceItemIdx      int `json:"source_item_idx"`
		DestChecklistIdx   int `json:"dest_checklist_idx"`
		DestItemIdx        int `json:"dest_item_idx"`
	}{sourceChecklistIdx, sourceItemIdx, destChecklistIdx, destItemIdx}

	req, err := s.client.newRequest(http.MethodPost, createURL, body)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}
