package client

import (
	"context"
	"net/http"
)

// StatsService handles communication with the stats related methods.
type StatsService struct {
	client *Client
}

type PlaybookSiteStats struct {
	TotalPlaybooks    int `json:"total_playbooks"`
	TotalPlaybookRuns int `json:"total_playbook_runs"`
}

// Get the configured settings.
func (s *StatsService) GetSiteStats(ctx context.Context) (*PlaybookSiteStats, error) {
	statsURL := "sitestats"
	req, err := s.client.newRequest(http.MethodGet, statsURL, nil)
	if err != nil {
		return nil, err
	}

	stats := new(PlaybookSiteStats)
	resp, err := s.client.do(ctx, req, stats)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return stats, nil
}
