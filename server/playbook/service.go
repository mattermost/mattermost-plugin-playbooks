package playbook

type service struct {
	store Store
}

// NewService returns a new playbook service
func NewService(store Store) Service {
	return &service{
		store: store,
	}
}

func (s *service) Create(playbook Playbook) (string, error) {
	return s.store.Create(playbook)
}

func (s *service) Get(id string) (Playbook, error) {
	return s.store.Get(id)
}

func (s *service) GetPlaybooks() ([]Playbook, error) {
	return s.store.GetPlaybooks()
}

func (s *service) GetPlaybooksForTeam(teamID string) ([]Playbook, error) {
	playbooks, err := s.store.GetPlaybooks()
	if err != nil {
		return nil, err
	}

	teamPlaybooks := make([]Playbook, 0, len(playbooks))
	for _, playbook := range playbooks {
		if playbook.TeamID == teamID {
			teamPlaybooks = append(teamPlaybooks, playbook)
		}
	}

	return teamPlaybooks, nil
}

func (s *service) Update(playbook Playbook) error {
	return s.store.Update(playbook)
}

func (s *service) Delete(id string) error {
	return s.store.Delete(id)
}
