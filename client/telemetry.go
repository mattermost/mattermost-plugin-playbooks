package client

import (
	"context"
	"fmt"
	"net/http"
)

type TelemetryService struct {
	client *Client
}

func (s *TelemetryService) CreateEvent(ctx context.Context, name string, eventType string, properties map[string]interface{}) error {

	payload := struct {
		Type       string
		Name       string
		Properties map[string]interface{}
	}{
		Type:       eventType,
		Name:       name,
		Properties: properties,
	}

	req, err := s.client.newRequest(http.MethodPost, "telemetry", payload)
	if err != nil {
		return err
	}

	resp, err := s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("expected status code %d, got %d", http.StatusNoContent, resp.StatusCode)
	}

	return nil
}
