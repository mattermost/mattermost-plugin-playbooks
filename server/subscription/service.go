package subscription

type service struct {
	store Store
}

// NewService returns a new subscription service
func NewService(store Store) Service {
	return &service{
		store: store,
	}
}

func (s *service) Create(subscription Subscription) (string, error) {
	newID, err := s.store.Create(subscription)
	if err != nil {
		return "", err
	}
	subscription.ID = newID

	return newID, nil
}
