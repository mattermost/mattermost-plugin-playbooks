package subscription

type service struct {
	store Store
}

// NewService returns a new subscription service backed by the passed store.
func NewService(store Store) Service {
	return &service{
		store: store,
	}
}

// Create stores a new subscription. It returns the new ID of the subscription,
// or an empty string and a non-nil error if the underlying store was not able
// to save the subscription.
func (s *service) Create(subscription Subscription) (string, error) {
	newID, err := s.store.Create(subscription)
	if err != nil {
		return "", err
	}

	return newID, nil
}
