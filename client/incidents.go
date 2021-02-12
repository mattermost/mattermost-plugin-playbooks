// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
)

// Incident represents an incident.
type Incident struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	IsActive        bool   `json:"is_active"`
	CommanderUserID string `json:"commander_user_id"`
	TeamID          string `json:"team_id"`
	ChannelID       string `json:"channel_id"`
	CreateAt        int64  `json:"create_at"`
	EndAt           int64  `json:"end_at"`
}

// IncidentCreateOptions specifies the parameters for IncidentsService.Create method.
type IncidentCreateOptions struct {
	Name            string `json:"name"`
	CommanderUserID string `json:"commander_user_id"`
	TeamID          string `json:"team_id"`
}

// IncidentListOptions specifies the optional parameters to the
// IncidentsService.List method.
type IncidentListOptions struct {
	ListOptions

	TeamID string `url:"team_id,omitempty"`

	Sort      IncidentSort  `url:"sort,omitempty"`
	Direction SortDirection `url:"direction,omitempty"`
}

// IncidentSort enumerates the available fields we can sort on.
type IncidentSort string

const (
	// CreateAt sorts by the "create_at" field. It is the default.
	CreateAt IncidentSort = "create_at"

	// ID sorts by the "id" field.
	ID IncidentSort = "id"

	// Name sorts by the "name" field.
	Name IncidentSort = "name"

	// CommanderUserID sorts by the "commander_user_id" field.
	CommanderUserID IncidentSort = "commander_user_id"

	// TeamID sorts by the "team_id" field.
	TeamID IncidentSort = "team_id"

	// EndAt sorts by the "end_at" field.
	EndAt IncidentSort = "end_at"
)

// IncidentList contains the paginated result.
type IncidentList struct {
	ListResult
	Items []*Incident
}

// IncidentsService handles communication with the incident related
// methods of the workflows API.
type IncidentsService struct {
	client *Client
}

// Create an incident.
func (s *IncidentsService) Create(ctx context.Context, opts IncidentCreateOptions) (*Incident, error) {
	// Just a proof of concept, this will be switched over to POST /incidents
	// TODO: switch to using /incidents
	u := "incidents/create-dialog"
	dialogRequest := model.SubmitDialogRequest{
		TeamId:     opts.TeamID,
		UserId:     opts.CommanderUserID,
		State:      "{}",
		Submission: map[string]interface{}{incident.DialogFieldNameKey: opts.Name},
	}

	req, err := s.client.NewRequest(http.MethodPost, u, dialogRequest)
	if err != nil {
		return nil, err
	}

	i := new(Incident)
	resp, err := s.client.Do(ctx, req, i)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return i, nil
}

// Get an incident.
func (s *IncidentsService) Get(ctx context.Context, incidentID string) (*Incident, error) {
	incidentURL := fmt.Sprintf("incidents/%s", incidentID)
	req, err := s.client.NewRequest(http.MethodGet, incidentURL, nil)
	if err != nil {
		return nil, err
	}

	incident := new(Incident)
	resp, err := s.client.Do(ctx, req, incident)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return incident, nil
}

// GetByChannelID gets an incident by ChannelID.
func (s *IncidentsService) GetByChannelID(ctx context.Context, channelID string) (*Incident, error) {
	channelURL := fmt.Sprintf("incidents/channel/%s", channelID)
	req, err := s.client.NewRequest(http.MethodGet, channelURL, nil)
	if err != nil {
		return nil, err
	}

	incident := new(Incident)
	resp, err := s.client.Do(ctx, req, incident)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return incident, nil
}

// Update an incident.
func (s *IncidentsService) Update(ctx context.Context, incidentID string, opts incident.UpdateOptions) (*Incident, error) {
	incidentURL := fmt.Sprintf("incidents/%s", incidentID)

	req, err := s.client.NewRequest(http.MethodPatch, incidentURL, opts)
	if err != nil {
		return nil, err
	}

	_, err = s.client.Do(ctx, req, nil)
	if err != nil {
		return nil, err
	}

	return nil, nil
}

// List the incidents.
func (s *IncidentsService) List(ctx context.Context, opts incident.HeaderFilterOptions) (*incident.GetIncidentsResults, error) {
	incidentURL := "incidents"
	incidentURL, err := addOptions(incidentURL, opts)
	if err != nil {
		return nil, err
	}

	req, err := s.client.NewRequest(http.MethodGet, incidentURL, nil)
	if err != nil {
		return nil, err
	}

	result := &IncidentList{}
	resp, err := s.client.Do(ctx, req, result)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return result, nil
}

// Delete an incident.
func (s *IncidentsService) Delete(ctx context.Context, incidentID string) error {
	incidentURL := fmt.Sprintf("incidents/%s", incidentID)

	req, err := s.client.NewRequest(http.MethodDelete, incidentURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.Do(ctx, req, nil)
	if err != nil {
		return err
	}

	return nil
}

// End an incident.
func (s *IncidentsService) End(ctx context.Context, incidentID string) error {
	incidentURL := fmt.Sprintf("incidents/%s/end", incidentID)

	req, err := s.client.NewRequest(http.MethodPut, incidentURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.Do(ctx, req, nil)
	if err != nil {
		return err
	}

	return nil
}
