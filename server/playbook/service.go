package playbook

type service struct {
	store Store
}

func (s *service) Create(playbook Playbook) (string, error) {
	return s.store.Create(playbook)
}
