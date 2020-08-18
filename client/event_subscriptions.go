// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"

	"github.com/pkg/errors"
)

// EventSubscriptions represents a EventSubscription.
type EventSubscriptions struct {
	ID string `json:"id"`
}

// EventSubscriptionCreateOptions specifies the parameters for EventSubscriptionsService.Create method.
type EventSubscriptionCreateOptions struct {
	Name *string `json:"name"`
}

// EventSubscriptionUpdateOptions specifies the parameters for EventSubscriptionsService.Update method.
type EventSubscriptionUpdateOptions struct {
	Name *string `json:"name"`
}

// EventSubscriptionUpdateOptionsListOptions specifies the optional parameters to the
// EventSubscriptionsService.List method.
type EventSubscriptionUpdateOptionsListOptions struct {
	ListOptions
}

// EventSubscriptionList contains the paginated result.
type EventSubscriptionList struct {
	ListResult
	Items []*EventSubscriptions
}

// EventSubscriptionsService handles communication with the eventsubscriptions related
// methods of the workflows API.
type EventSubscriptionsService struct {
	client *Client
}

// Create an event subscription.
func (s *EventSubscriptionsService) Create(ctx context.Context, opts EventSubscriptionCreateOptions) (*EventSubscriptions, error) {
	return nil, errors.New("not implemented")
}

// Get an event subscription.
func (s *EventSubscriptionsService) Get(ctx context.Context, playbookID string) (*EventSubscriptions, error) {
	return nil, errors.New("not implemented")
}

// Update an event subscription.
func (s *EventSubscriptionsService) Update(ctx context.Context, opts EventSubscriptionUpdateOptions) (*EventSubscriptions, error) {
	return nil, errors.New("not implemented")
}

// List event subscriptions.
func (s *EventSubscriptionsService) List(ctx context.Context, opts EventSubscriptionUpdateOptionsListOptions) (*EventSubscriptionList, error) {
	return nil, errors.New("not implemented")
}

// Delete an event subscription.
func (s *EventSubscriptionsService) Delete(ctx context.Context, eventSubscriptionID string) (*EventSubscriptions, error) {
	return nil, errors.New("not implemented")
}
