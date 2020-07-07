package subscription

import (
	"net/url"
)

// Subscription defines a playbook-scoped subscription assigned to a specific
// user.
type Subscription struct {
	ID         string  `json:"id"`
	URL        url.URL `json:"url"`
	PlaybookID string  `json:"playbook_id"`
	UserID     string  `json:"user_id"`
}

// Service defines the behavior of a subscription service.
type Service interface {
	Create(subscription Subscription) (string, error)
}

// Store defines the behavior of a subscription store used by the
// subscription service.
type Store interface {
	Create(subscription Subscription) (string, error)
}
