// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package gotenberg

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
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
// endpoint. The HTML body is posted verbatim as the "index.html" multipart
// part — this is the single source of truth shared with the .html endpoint.
func (c *Client) Render(ctx context.Context, html []byte, opts html2pdf.Options) ([]byte, error) {
	// Validate PDF/A against Capabilities before making any HTTP call.
	if opts.PdfAFlavor != "" {
		supported := c.Capabilities().SupportsPDFA
		ok := false
		for _, f := range supported {
			if f == opts.PdfAFlavor {
				ok = true
				break
			}
		}
		if !ok {
			return nil, fmt.Errorf("gotenberg: unsupported PDF/A flavor %q", opts.PdfAFlavor)
		}
	}

	// Acquire semaphore slot (GotenbergMaxConcurrent cap).
	select {
	case c.sem <- struct{}{}:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	defer func() { <-c.sem }()

	// Build multipart body expected by Gotenberg's
	// POST /forms/chromium/convert/html endpoint.
	// The HTML file must be named "index.html".
	var body bytes.Buffer
	w := multipart.NewWriter(&body)

	// Write index.html part.
	fw, err := w.CreateFormFile("files", "index.html")
	if err != nil {
		return nil, fmt.Errorf("gotenberg: create form file: %w", err)
	}
	if _, err = fw.Write(html); err != nil {
		return nil, fmt.Errorf("gotenberg: write html: %w", err)
	}

	// PDF/A flavor.
	if opts.PdfAFlavor != "" {
		if err = w.WriteField("pdfa", opts.PdfAFlavor); err != nil {
			return nil, fmt.Errorf("gotenberg: write pdfa field: %w", err)
		}
	}

	// Page size (Gotenberg default is A4).
	if opts.PageSize != "" && opts.PageSize != "A4" {
		if err = w.WriteField("paperWidth", pageSizeWidth(opts.PageSize)); err != nil {
			return nil, fmt.Errorf("gotenberg: write paperWidth: %w", err)
		}
		if err = w.WriteField("paperHeight", pageSizeHeight(opts.PageSize)); err != nil {
			return nil, fmt.Errorf("gotenberg: write paperHeight: %w", err)
		}
	}

	if err = w.Close(); err != nil {
		return nil, fmt.Errorf("gotenberg: close multipart: %w", err)
	}

	url := strings.TrimRight(c.cfg.BaseURL, "/") + "/forms/chromium/convert/html"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &body)
	if err != nil {
		return nil, fmt.Errorf("gotenberg: create request: %w", err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	if c.cfg.AuthHeader != "" {
		req.Header.Set("Authorization", c.cfg.AuthHeader)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gotenberg: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gotenberg: unexpected status %d", resp.StatusCode)
	}

	maxBytes := c.cfg.MaxResponseBytes
	if maxBytes == 0 {
		maxBytes = 100 * 1024 * 1024
	}
	limited := io.LimitReader(resp.Body, maxBytes+1)
	pdfBytes, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("gotenberg: read response: %w", err)
	}
	if int64(len(pdfBytes)) > maxBytes {
		return nil, fmt.Errorf("gotenberg: response exceeded %d bytes cap", maxBytes)
	}
	return pdfBytes, nil
}

// pageSizeWidth returns the paperWidth value for a page size hint.
func pageSizeWidth(size string) string {
	switch size {
	case "Letter":
		return "8.5in"
	default:
		return "8.27in" // A4
	}
}

// pageSizeHeight returns the paperHeight value for a page size hint.
func pageSizeHeight(size string) string {
	switch size {
	case "Letter":
		return "11in"
	default:
		return "11.69in" // A4
	}
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
