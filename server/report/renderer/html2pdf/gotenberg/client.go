// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package gotenberg

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report/renderer/html2pdf"
)

// Config holds the runtime configuration for the Gotenberg adapter.
type Config struct {
	BaseURL          string // HTTP base URL of the Gotenberg sidecar
	AuthHeader       string // Optional Authorization header value (e.g. "Bearer <token>")
	TimeoutSec       int    // Per-request timeout; 0 → default 30 s
	MaxConcurrent    int    // Plugin-side semaphore size; 0 → default 4
	PdfAFlavor       string // "", "PDF/A-1a", "PDF/A-2b", "PDF/A-3b"
	MaxResponseBytes int64  // io.LimitReader cap; 0 → default 100 MiB
}

// Client implements html2pdf.HTMLPdfRenderer using Gotenberg.
type Client struct {
	cfg    Config
	client *http.Client
	sem    chan struct{}
}

// New constructs a Gotenberg client from cfg. Call HealthCheck immediately
// to verify connectivity.
func New(cfg Config) *Client {
	timeout := time.Duration(cfg.TimeoutSec) * time.Second
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	maxConc := cfg.MaxConcurrent
	if maxConc == 0 {
		maxConc = 4
	}
	return &Client{
		cfg:    cfg,
		client: &http.Client{Timeout: timeout},
		sem:    make(chan struct{}, maxConc),
	}
}

// Name returns the renderer name for audit + diagnostics.
func (c *Client) Name() string { return "gotenberg" }

// Capabilities returns what this Gotenberg adapter supports.
func (c *Client) Capabilities() html2pdf.Capabilities {
	return html2pdf.Capabilities{
		SupportsPDFA:  []string{"PDF/A-1a", "PDF/A-2b", "PDF/A-3b"},
		SupportsLinks: true,
		MaxPageCount:  0,
	}
}

// Render converts HTML to PDF via Gotenberg's /forms/chromium/convert/html
// endpoint. Phase A stub — returns not-implemented; full implementation
// lands in Phase D.
func (c *Client) Render(_ context.Context, _ []byte, _ html2pdf.Options) ([]byte, error) {
	return nil, fmt.Errorf("gotenberg: Render not yet implemented (Phase D)")
}

// HealthCheck probes Gotenberg's /health endpoint.
func (c *Client) HealthCheck(ctx context.Context) error {
	if c.cfg.BaseURL == "" {
		return fmt.Errorf("gotenberg: BaseURL is not configured")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.BaseURL+"/health", nil)
	if err != nil {
		return fmt.Errorf("gotenberg: health check request: %w", err)
	}
	if c.cfg.AuthHeader != "" {
		req.Header.Set("Authorization", c.cfg.AuthHeader)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("gotenberg: health check failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("gotenberg: health check returned status %d", resp.StatusCode)
	}
	return nil
}
