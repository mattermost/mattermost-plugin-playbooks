package subscription

import (
	"net/url"
)

type Subscription struct {
	ID         string
	URL        url.URL
	PlaybookId string
}

type Service interface {
	Create(subscription Subscription) (string, error)
}

type Store interface {
	Create(subscription Subscription) (string, error)
}
