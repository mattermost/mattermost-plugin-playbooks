// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"math"
	"net/http"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

// Incident represents an incident.
type Incident struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	IsActive         bool   `json:"is_active"`
	CommanderUserID  string `json:"commander_user_id"`
	TeamID           string `json:"team_id"`
	PrimaryChannelID string `json:"primary_channel_id"`
	CreatedAt        int64  `json:"created_at"`
	EndedAt          int64  `json:"ended_at"`
}

// IncidentCreateOptions specifies the parameters for IncidentsService.Create method.
type IncidentCreateOptions struct {
	Name            string `json:"name"`
	CommanderUserID string `json:"commander_user_id"`
	TeamID          string `json:"team_id"`
}

// IncidentUpdateOptions specifies the parameters for IncidentsService.Update method.
type IncidentUpdateOptions struct {
	CommanderUserID *string `json:"commander_user_id"`
}

// IncidentListOptions specifies the optional parameters to the
// IncidentsService.List method.
type IncidentListOptions struct {
	ListOptions

	TeamID string `url:"team_id,omitempty"`

	Sort      IncidentSort  `url:"sort,omitempty"`
	Direction SortDirection `url:"order,omitempty"`
}

// IncidentSort enumerates the available fields we can sort on.
type IncidentSort string

const (
	// CreatedAt sorts by the "created_at" field. It is the default.
	CreatedAt IncidentSort = "created_at"

	// ID sorts by the "id" field.
	ID IncidentSort = "id"

	// Name sorts by the "name" field.
	Name IncidentSort = "name"

	// CommanderUserID sorts by the "commander_user_id" field.
	CommanderUserID IncidentSort = "commander_user_id"

	// TeamID sorts by the "team_id" field.
	TeamID IncidentSort = "team_id"

	// EndedAt sorts by the "ended_at" field.
	EndedAt IncidentSort = "ended_at"

	// ByStatus sorts by the "status" field.
	ByStatus IncidentSort = "by_status"
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
	u := fmt.Sprintf("%s/%s", apiVersion, "incidents/create-dialog")
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
	_, err = s.client.Do(ctx, req, i)
	if err != nil {
		return nil, err
	}

	return i, nil
}

// Get an incident.
func (s *IncidentsService) Get(ctx context.Context, incidentID string) (*Incident, error) {
	u := fmt.Sprintf("%s/%s/%s", apiVersion, "incidents", incidentID)
	req, err := s.client.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}

	i := new(Incident)
	_, err = s.client.Do(ctx, req, i)
	if err != nil {
		return nil, err
	}

	return i, nil
}

// GetByChannelID gets an incident by ChannelID.
func (s *IncidentsService) GetByChannelID(ctx context.Context, channelID string) (*Incident, error) {
	return nil, errors.New("not implemented")
}

// Update an incident.
func (s *IncidentsService) Update(ctx context.Context, incidentID string, incident IncidentUpdateOptions) (*Incident, error) {
	return nil, errors.New("not implemented")
}

// List the incidents.
func (s *IncidentsService) List(ctx context.Context, opts IncidentListOptions) (*IncidentList, error) {
	u := fmt.Sprintf("%s/%s", apiVersion, "incidents")
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, err
	}

	req, err := s.client.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}

	// Proof of concept, this will be updated to the correct payloads and we wouldn't need this anonymous struct
	// TODO: remove anonymous struct
	i := new(struct {
		Incidents  []*Incident `json:"incidents"`
		TotalCount int         `json:"total_count"`
	})
	_, err = s.client.Do(ctx, req, i)
	if err != nil {
		return nil, err
	}

	// Should be returned by the server
	opts.PerPage = 1000
	pageCount := int(math.Floor(float64(i.TotalCount / opts.PerPage)))
	return &IncidentList{
		ListResult: ListResult{
			TotalCount: i.TotalCount,
			PageCount:  pageCount,
			HasMore:    pageCount-1 > opts.Page,
		},
		Items: i.Incidents,
	}, nil
}

// Delete an incident.
func (s *IncidentsService) Delete(ctx context.Context, incidentID string) (*Incident, error) {
	return nil, errors.New("not implemented")
}

// End an incident.
func (s *IncidentsService) End(ctx context.Context, incidentID string) (*Incident, error) {
	return nil, errors.New("not implemented")
}
