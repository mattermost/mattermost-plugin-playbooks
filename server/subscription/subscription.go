package subscription

import (
	"net/url"
)

type Subscription struct {
	ID         string  `json:"id"`
	URL        url.URL `json:"url"`
	PlaybookID string  `json:"playbook_id"`
	UserID     string  `json:"user_id"`
}

type Service interface {
	Create(subscription Subscription) (string, error)
}

type Store interface {
	Create(subscription Subscription) (string, error)
}
