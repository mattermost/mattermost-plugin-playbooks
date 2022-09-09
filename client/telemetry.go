package client

import (
	"context"
	"fmt"
	"io/ioutil"
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

	resp, err := s.client.do(ctx, req, ioutil.Discard)
	if err != nil {
		return err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("expected status code %d", http.StatusNoContent)
	}

	return nil
}
