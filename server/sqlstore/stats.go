package sqlstore

import (
	"fmt"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-server/v5/model"
)

type StatsStore struct {
	pluginAPI PluginAPIClient
	log       bot.Logger
	store     *SQLStore
}

func NewStatsStore(pluginAPI PluginAPIClient, log bot.Logger, sqlStore *SQLStore) *StatsStore {
	return &StatsStore{
		pluginAPI: pluginAPI,
		log:       log,
		store:     sqlStore,
	}
}

func (s *StatsStore) TotalReportedIncidents() int {
	query := s.store.builder.
		Select("COUNT(ID)").
		From("IR_Incident").
		Where("CurrentStatus = 'Reported'")

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		// TODO: Error properly
		return -1
	}

	return total
}

func (s *StatsStore) TotalActiveIncidents() int {
	query := s.store.builder.
		Select("COUNT(ID)").
		From("IR_Incident").
		Where("CurrentStatus = 'Active'")

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		// TODO: Error properly
		return -1
	}

	return total
}

func (s *StatsStore) TotalActiveParticipants() int {
	query := s.store.builder.
		Select("COUNT(DISTINCT cm.UserId)").
		From("ChannelMembers as cm").
		Join("IR_Incident AS i ON i.ChannelId = cm.ChannelId").
		Where("i.EndAt = 0")

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		// TODO: Error properly
		return -1
	}

	return total
}

func (s *StatsStore) AverageDurationActiveIncidentsMinutes() int {
	query := s.store.builder.
		Select("AVG(c.CreateAt)").
		From("IR_Incident AS i").
		Join("Channels AS c ON (c.Id = i.ChannelId)").
		Where("i.EndAt = 0")

	var averageCreateAt float64
	if err := s.store.getBuilder(s.store.db, &averageCreateAt, query); err != nil {
		// TODO: Error properly
		return -1
	}

	return int((float64(model.GetMillis()) - averageCreateAt) / 60000)
}

type PlaybookUse struct {
	Name    string `json:"name"`
	NumUses int    `json:"num_uses"`
}

func (s *StatsStore) PlaybookUses() []PlaybookUse {
	query := s.store.builder.
		Select("pb.Title as Name, count(i.PlaybookID) as NumUses").
		From("IR_Incident as i").
		Join("IR_Playbook as pb ON i.PlaybookID = pb.ID").
		GroupBy("pb.Title")

	var uses []PlaybookUse
	if err := s.store.selectBuilder(s.store.db, &uses, query); err != nil {
		// TODO: Error properly
		fmt.Println(err)
		return []PlaybookUse{}
	}

	return uses
}

func (s *StatsStore) MovingWindowQueryActive(query sq.SelectBuilder, numDays int) ([]int, error) {
	now := model.GetMillis()
	dayInMS := int64(86400000)

	results := []int{}
	for i := 0; i < numDays; i++ {
		modifiedQuery := query.Where(
			sq.Expr(
				`c.CreateAt < ? AND (i.EndAt > ? OR i.EndAt = 0)`,
				now-(int64(i)*dayInMS),
				now-(int64(i+1)*dayInMS),
			),
		)

		var value int
		if err := s.store.getBuilder(s.store.db, &value, modifiedQuery); err != nil {
			return nil, err
		}

		results = append(results, value)
	}

	return results, nil
}

func (s *StatsStore) ActiveIncidents() []int {
	query := s.store.builder.
		Select("COUNT(i.Id)").
		From("IR_Incident as i").
		Join("Channels AS c ON (c.Id = i.ChannelId)")

	activeIncidents, err := s.MovingWindowQueryActive(query, 14)
	if err != nil {
		s.log.Warnf("Unable to get active incidents %w", err)
		return []int{}
	}

	return activeIncidents
}

func (s *StatsStore) PeopleInIncidents() []int {
	query := s.store.builder.
		Select("COUNT(DISTINCT cm.UserId)").
		From("ChannelMembers as cm").
		Join("IR_Incident AS i ON i.ChannelId = cm.ChannelId").
		Join("Channels AS c ON (c.Id = i.ChannelId)")

	peopleInIncidents, err := s.MovingWindowQueryActive(query, 14)
	if err != nil {
		s.log.Warnf("Unable to get people in incidents %w", err)
		return []int{}
	}

	return peopleInIncidents
}

func (s *StatsStore) AverageStartToActive() []int {
	firstNonReportedStatusPost := `(
		SELECT p.CreateAt 
		FROM IR_StatusPosts sp 
		JOIN Posts AS p ON sp.PostId = p.Id 
		WHERE sp.Status != 'Reported' AND sp.IncidentId = i.Id 
		ORDER BY p.CreateAt ASC 
		LIMIT 1
	)`
	query := s.store.builder.
		Select(fmt.Sprintf("COALESCE(FLOOR(AVG(%s - c.CreateAt)), 0)", firstNonReportedStatusPost)).
		From("IR_Incident as i").
		Join("Channels AS c ON (c.Id = i.ChannelId)")

	peopleInIncidents, err := s.MovingWindowQueryActive(query, 42)
	if err != nil {
		s.log.Warnf("Unable to get average start to active %w", err)
		return []int{}
	}

	return peopleInIncidents
}

func (s *StatsStore) AverageStartToResolved() []int {
	query := s.store.builder.
		Select("COALESCE(FLOOR(AVG(i.EndAt - c.CreateAt)), 0)").
		From("IR_Incident as i").
		Join("Channels AS c ON (c.Id = i.ChannelId)").
		Where("i.EndAt != 0")

	peopleInIncidents, err := s.MovingWindowQueryActive(query, 42)
	if err != nil {
		s.log.Warnf("Unable to get average start time to resolved %w", err)
		return []int{}
	}

	return peopleInIncidents
}
