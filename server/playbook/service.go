package playbook

import (
	"sort"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
)

type service struct {
	store     Store
	poster    bot.Poster
	telemetry Telemetry
}

// NewService returns a new playbook service
func NewService(store Store, poster bot.Poster, telemetry Telemetry) Service {
	return &service{
		store:     store,
		poster:    poster,
		telemetry: telemetry,
	}
}

func (s *service) Create(playbook Playbook) (string, error) {
	newID, err := s.store.Create(playbook)
	if err != nil {
		return "", err
	}
	playbook.ID = newID

	s.telemetry.CreatePlaybook(playbook)

	return newID, nil
}

func (s *service) Get(id string) (Playbook, error) {
	return s.store.Get(id)
}

func (s *service) GetPlaybooks() ([]Playbook, error) {
	return s.store.GetPlaybooks()
}

func (s *service) GetPlaybooksForTeam(teamID string, opts Options) ([]Playbook, error) {
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

	if err := sortPlaybooks(teamPlaybooks, opts); err != nil {
		return nil, err
	}

	return teamPlaybooks, nil
}

func (s *service) Update(playbook Playbook) error {
	if err := s.store.Update(playbook); err != nil {
		return err
	}

	s.telemetry.UpdatePlaybook(playbook)

	return nil
}

func (s *service) Delete(playbook Playbook) error {
	if playbook.ID == "" {
		return errors.New("can't delete a playbook without an ID")
	}

	if err := s.store.Delete(playbook.ID); err != nil {
		return err
	}

	s.telemetry.DeletePlaybook(playbook)

	return nil
}

func sortPlaybooks(playbooks []Playbook, opts Options) error {
	var sortDirectionFn func(b bool) bool
	switch opts.Direction {
	case Asc:
		sortDirectionFn = func(b bool) bool { return !b }
	case Desc:
		sortDirectionFn = func(b bool) bool { return b }
	default:
		return errors.Errorf("invalid sort direction %s", opts.Direction)
	}

	var sortFn func(i, j int) bool
	switch opts.Sort {
	case Title:
		sortFn = func(i, j int) bool {
			return sortDirectionFn(playbooks[i].Title > playbooks[j].Title)
		}
	case Stages:
		sortFn = func(i, j int) bool {
			return sortDirectionFn(len(playbooks[i].Checklists) > len(playbooks[j].Checklists))
		}
	case Steps:
		sortFn = func(i, j int) bool {
			stepsI := getSteps(playbooks[i])
			stepsJ := getSteps(playbooks[j])
			return sortDirectionFn(stepsI > stepsJ)
		}
	default:
		return errors.Errorf("invalid sort field %s", opts.Sort)
	}

	sort.Slice(playbooks, sortFn)
	return nil
}

func getSteps(playbook Playbook) int {
	steps := 0
	for _, p := range playbook.Checklists {
		steps += len(p.Items)
	}
	return steps
}
