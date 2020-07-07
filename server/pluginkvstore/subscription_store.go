package pluginkvstore

import (
	"encoding/json"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-response/server/subscription"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	subscriptionKey = keyVersionPrefix + "subscription_"
	indexKey        = keyVersionPrefix + "subscriptionindex"
)

type subscriptionIndex struct {
	SubscriptionIDs []string `json:"subscription_ids"`
}

func (i *subscriptionIndex) clone() subscriptionIndex {
	newIndex := *i
	newIndex.SubscriptionIDs = append([]string(nil), i.SubscriptionIDs...)
	return newIndex
}

// SubscriptionStore is KVStore backend for a subscription service.
type SubscriptionStore struct {
	kvAPI KVAPI
}

// NewSubscriptionStore creates a new subscription store that uses the passed
// KV API.
func NewSubscriptionStore(kvAPI KVAPI) *SubscriptionStore {
	return &SubscriptionStore{
		kvAPI: kvAPI,
	}
}

func (s *SubscriptionStore) addToIndex(subscriptionID string) error {
	addID := func(oldValue []byte) (interface{}, error) {
		var index subscriptionIndex
		if err := json.Unmarshal(oldValue, &index); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal oldValue into a subscriptionIndex")
		}

		newIndex := index.clone()
		newIndex.SubscriptionIDs = append(newIndex.SubscriptionIDs, subscriptionID)

		return newIndex, nil
	}

	if err := s.kvAPI.SetAtomicWithRetries(indexKey, addID); err != nil {
		return errors.Wrap(err, "failed to set subscriptionIndex atomically")
	}
	return nil
}

// Create stores a new subscription in the KV store. It returns the new ID of
// the subscription, or an empty string and a non-nil error if the KV store
// failed to save the subscription or failed to add the new ID to the index.
func (s *SubscriptionStore) Create(subs subscription.Subscription) (string, error) {
	subs.ID = model.NewId()

	saved, err := s.kvAPI.Set(subscriptionKey+subs.ID, &subs)
	if err != nil {
		return "", errors.Wrapf(err, "unable to save subscription to KV store")
	}
	if !saved {
		return "", errors.New("unable to save subscription to KV store, KV Set didn't save")
	}

	err = s.addToIndex(subs.ID)
	if err != nil {
		return "", errors.Wrapf(err, "unable to add the new subscription to the index")
	}

	return subs.ID, nil
}
