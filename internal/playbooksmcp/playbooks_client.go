package playbooksmcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const pluginAPIPath = "plugins/playbooks/api/v0"

// PlaybooksClient is a thin HTTP client for the Playbooks plugin REST API.
type PlaybooksClient struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

// NewPlaybooksClient creates a new Playbooks API client.
func NewPlaybooksClient(serverURL, token string) *PlaybooksClient {
	return &PlaybooksClient{
		baseURL:    strings.TrimRight(serverURL, "/"),
		token:      token,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// doRequest executes an HTTP request and decodes the JSON response into result.
// If result is nil, the response body is discarded.
func (c *PlaybooksClient) doRequest(ctx context.Context, method, endpoint string, body any, result any) error {
	u := fmt.Sprintf("%s/%s/%s", c.baseURL, pluginAPIPath, endpoint)

	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, u, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, readErr := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
		if readErr != nil {
			return fmt.Errorf("API error (status %d); could not read response body: %w", resp.StatusCode, readErr)
		}
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	} else {
		_, _ = io.Copy(io.Discard, resp.Body)
	}

	return nil
}

// Get performs a GET request to the given endpoint with optional query parameters.
func (c *PlaybooksClient) Get(ctx context.Context, endpoint string, params url.Values, result any) error {
	if len(params) > 0 {
		endpoint = endpoint + "?" + params.Encode()
	}
	return c.doRequest(ctx, http.MethodGet, endpoint, nil, result)
}

// Post performs a POST request.
func (c *PlaybooksClient) Post(ctx context.Context, endpoint string, body any, result any) error {
	return c.doRequest(ctx, http.MethodPost, endpoint, body, result)
}

// Put performs a PUT request.
func (c *PlaybooksClient) Put(ctx context.Context, endpoint string, body any, result any) error {
	return c.doRequest(ctx, http.MethodPut, endpoint, body, result)
}

// Delete performs a DELETE request.
func (c *PlaybooksClient) Delete(ctx context.Context, endpoint string) error {
	return c.doRequest(ctx, http.MethodDelete, endpoint, nil, nil)
}

// GetCurrentUserID checks that the token is valid by calling the Mattermost API
// and returns the authenticated user's ID.
func (c *PlaybooksClient) GetCurrentUserID(ctx context.Context) (string, error) {
	u := fmt.Sprintf("%s/api/v4/users/me", c.baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create validation request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("token validation request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
		return "", fmt.Errorf("token validation failed (status %d): %s", resp.StatusCode, string(respBody))
	}

	var user struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return "", fmt.Errorf("failed to decode user response: %w", err)
	}

	return user.ID, nil
}

// ValidateToken checks that the token is valid by calling the Mattermost API.
func (c *PlaybooksClient) ValidateToken(ctx context.Context) error {
	_, err := c.GetCurrentUserID(ctx)
	return err
}
