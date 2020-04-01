package playbook

type service struct {
	store Store
}

func NewService(store Store) *service {
	return &service{
		store: store,
	}
}

func (s *service) Create(playbook Playbook) (string, error) {
	return s.store.Create(playbook)
}
