// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"
)

// IncidentsService handles communication with the incident related
// methods of the workflows API.
type IncidentsService struct {
	client *Client
}

// Get an incident.
func (s *IncidentsService) Get(ctx context.Context, incidentID string) (*Incident, error) {
	incidentURL := fmt.Sprintf("incidents/%s", incidentID)
	req, err := s.client.newRequest(http.MethodGet, incidentURL, nil)
	if err != nil {
		return nil, err
	}

	incident := new(Incident)
	resp, err := s.client.do(ctx, req, incident)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return incident, nil
}

// GetByChannelID gets an incident by ChannelID.
func (s *IncidentsService) GetByChannelID(ctx context.Context, channelID string) (*Incident, error) {
	channelURL := fmt.Sprintf("incidents/channel/%s", channelID)
	req, err := s.client.newRequest(http.MethodGet, channelURL, nil)
	if err != nil {
		return nil, err
	}

	incident := new(Incident)
	resp, err := s.client.do(ctx, req, incident)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return incident, nil
}

// Get an incident's metadata.
func (s *IncidentsService) GetMetadata(ctx context.Context, incidentID string) (*IncidentMetadata, error) {
	incidentURL := fmt.Sprintf("incidents/%s/metadata", incidentID)
	req, err := s.client.newRequest(http.MethodGet, incidentURL, nil)
	if err != nil {
		return nil, err
	}

	incident := new(IncidentMetadata)
	resp, err := s.client.do(ctx, req, incident)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return incident, nil
}

// List the incidents.
func (s *IncidentsService) List(ctx context.Context, opts IncidentListOptions) (*GetIncidentsResults, error) {
	incidentURL := "incidents"
	incidentURL, err := addOptions(incidentURL, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to build options: %w", err)
	}

	req, err := s.client.newRequest(http.MethodGet, incidentURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	result := &GetIncidentsResults{}
	resp, err := s.client.do(ctx, req, result)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	resp.Body.Close()

	return result, nil
}

// Create an incident.
func (s *IncidentsService) Create(ctx context.Context, opts IncidentCreateOptions) (*Incident, error) {
	incidentURL := "incidents"
	req, err := s.client.newRequest(http.MethodPost, incidentURL, opts)
	if err != nil {
		return nil, err
	}

	incident := new(Incident)
	resp, err := s.client.do(ctx, req, incident)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("expected status code %d", http.StatusCreated)
	}

	return incident, nil
}
