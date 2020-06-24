// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"

	"github.com/pkg/errors"
)

// Webhook represents a webhook.
type Webhook struct {
	ID string `json:"id"`
}

// WebhookCreateOptions specifies the parameters for WebhooksService.Create method.
type WebhookCreateOptions struct {
	Name *string `json:"name"`
}

// WebhookUpdateOptions specifies the parameters for WebhooksService.Update method.
type WebhookUpdateOptions struct {
	Name *string `json:"name"`
}

// WebhookListOptions specifies the optional parameters to the
// WebhooksService.List method.
type WebhookListOptions struct {
	ListOptions
}

// WebhookList contains the paginated result.
type WebhookList struct {
	ListResult
	Items []*Webhook
}

// WebhooksService handles communication with the webhooks related
// methods of the workflows API.
type WebhooksService struct {
	client *Client
}

// Create a webhook incident.
func (s *WebhooksService) Create(ctx context.Context, opts WebhookCreateOptions) (*Webhook, error) {
	return nil, errors.New("not implemented")
}

// Get a webhook.
func (s *WebhooksService) Get(ctx context.Context, playbookID string) (*Webhook, error) {
	return nil, errors.New("not implemented")
}

// Update a webhook.
func (s *WebhooksService) Update(ctx context.Context, opts WebhookUpdateOptions) (*Webhook, error) {
	return nil, errors.New("not implemented")
}

// List the incidents.
func (s *WebhooksService) List(ctx context.Context, opts WebhookListOptions) (*WebhookList, error) {
	return nil, errors.New("not implemented")
}

// Delete a webhook.
func (s *WebhooksService) Delete(ctx context.Context, webhookID string) (*Webhook, error) {
	return nil, errors.New("not implemented")
}
