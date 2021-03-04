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
		s.log.Warnf("Error retriving stat %w", err)
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
		s.log.Warnf("Error retriving stat %w", err)
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
		s.log.Warnf("Error retriving stat %w", err)
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
		s.log.Warnf("Error retriving stat %w", err)
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
		s.log.Warnf("Error retriving stat %w", err)
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
	now := model.GetMillis()

	startQuery := s.store.builder.
		Select(fmt.Sprintf("COUNT(i.Id), (%v - c.CreateAt) / 86400000 as DayStarted", now)).
		From("IR_Incident as i").
		Join("Channels AS c ON (c.Id = i.ChannelId)").
		GroupBy("DayStarted").
		OrderBy("DayStarted ASC")

	var dayCountsStart []struct {
		Count      int
		DayStarted int
	}
	if err := s.store.selectBuilder(s.store.db, &dayCountsStart, startQuery); err != nil {
		s.log.Warnf("Unable to get start counts %w", err)
		return []int{}
	}

	started := make(map[int]int)
	for _, dcStart := range dayCountsStart {
		started[dcStart.DayStarted] = dcStart.Count
	}

	endQuery := s.store.builder.
		Select(fmt.Sprintf("COUNT(i.Id), (%v - i.EndAt) / 86400000 as DayEnded", now)).
		From("IR_Incident as i").
		Where("i.EndAt != 0").
		GroupBy("DayEnded").
		OrderBy("DayEnded ASC")

	var dayCountsEnd []struct {
		Count    int
		DayEnded int
	}
	if err := s.store.selectBuilder(s.store.db, &dayCountsEnd, endQuery); err != nil {
		s.log.Warnf("Unable to get end counts %w", err)
		return []int{}
	}

	ended := make(map[int]int)
	for _, dcEnd := range dayCountsEnd {
		ended[dcEnd.DayEnded] = dcEnd.Count
	}

	activeNowQuery := s.store.builder.
		Select("COUNT(i.Id)").
		From("IR_Incident as i").
		Where("i.EndAt = 0")

	var activeNow int
	if err := s.store.getBuilder(s.store.db, &activeNow, activeNowQuery); err != nil {
		s.log.Warnf("Unable to get active now %w", err)
		return []int{}
	}

	days := make([]int, 14)
	days[0] = activeNow
	for day := 1; day < 14; day++ {
		days[day] = days[day-1] + ended[day] - started[day-1]
	}

	return days
}

func (s *StatsStore) UniquePeopleInIncidents() []int {
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

func (s *StatsStore) PeopleInIncidents() []int {
	now := model.GetMillis()

	startQuery := s.store.builder.
		Select(fmt.Sprintf("COUNT(DISTINCT cm.UserId), (%v - cmh.JoinTime) / 86400000 as DayStarted", now)).
		From("ChannelMembers as cm").
		Join("IR_Incident AS i ON i.ChannelId = cm.ChannelId").
		Join("ChannelMemberHistory AS cmh ON (cmh.ChannelId = i.ChannelId)").
		GroupBy("DayStarted").
		OrderBy("DayStarted ASC")

	var dayCountsStart []struct {
		Count      int
		DayStarted int
	}
	if err := s.store.selectBuilder(s.store.db, &dayCountsStart, startQuery); err != nil {
		s.log.Warnf("Unable to get start counts %w", err)
		return []int{}
	}

	started := make(map[int]int)
	for _, dcStart := range dayCountsStart {
		started[dcStart.DayStarted] = dcStart.Count
	}

	endQuery := s.store.builder.
		Select(fmt.Sprintf("COUNT(DISTINCT cm.UserId), (%v - cmh.LeaveTime) / 86400000 as DayEnded", now)).
		From("ChannelMembers as cm").
		Join("IR_Incident AS i ON i.ChannelId = cm.ChannelId").
		Join("ChannelMemberHistory AS cmh ON (cmh.ChannelId = i.ChannelId)").
		Where("i.EndAt != 0").
		Where("cmh.LeaveTime != NULL").
		GroupBy("DayEnded").
		OrderBy("DayEnded ASC")

	var dayCountsEnd []struct {
		Count    int
		DayEnded int
	}
	if err := s.store.selectBuilder(s.store.db, &dayCountsEnd, endQuery); err != nil {
		s.log.Warnf("Unable to get end counts %w", err)
		return []int{}
	}

	ended := make(map[int]int)
	for _, dcEnd := range dayCountsEnd {
		ended[dcEnd.DayEnded] = dcEnd.Count
	}

	activeNow := s.TotalActiveParticipants()

	fmt.Printf("Counts: %+v\n %+v\n %v\n", dayCountsStart, dayCountsEnd, activeNow)

	days := make([]int, 14)
	days[0] = activeNow
	for day := 1; day < 14; day++ {
		days[day] = days[day-1] + ended[day] - started[day-1]
	}

	return days
}

func (s *StatsStore) AverageStartToActive() []int {
	daysToQuery := 42
	firstNonReportedStatusPost := `(
		SELECT p.CreateAt 
		FROM IR_StatusPosts sp 
		JOIN Posts AS p ON sp.PostId = p.Id 
		WHERE sp.Status != 'Reported' AND sp.IncidentId = i.Id 
		ORDER BY p.CreateAt ASC 
		LIMIT 1
	)`
	now := model.GetMillis()

	query := s.store.builder.
		Select(fmt.Sprintf("COALESCE(FLOOR(AVG(%s - c.CreateAt)), 0) as Average, (%v - c.CreateAt) / 86400000 as DayStarted", firstNonReportedStatusPost, now)).
		From("IR_Incident as i").
		Join("Channels AS c ON (c.Id = i.ChannelId)").
		GroupBy("DayStarted").
		OrderBy("DayStarted ASC")

	var averages []struct {
		Average    int
		DayStarted int
	}
	if err := s.store.selectBuilder(s.store.db, &averages, query); err != nil {
		s.log.Warnf("Unable to get average start to active %w", err)
		return []int{}
	}

	dayToAverage := make(map[int]int)
	for _, av := range averages {
		dayToAverage[av.DayStarted] = av.Average
	}

	days := make([]int, daysToQuery)
	for day := daysToQuery - 1; day >= 0; day-- {
		if val, ok := dayToAverage[day]; ok {
			days[day] = val
		} else {
			if day != daysToQuery-1 {
				days[day] = days[day+1]
			}
		}
	}

	return days
}

func (s *StatsStore) AverageStartToResolved() []int {
	daysToQuery := 42
	now := model.GetMillis()

	query := s.store.builder.
		Select(fmt.Sprintf("COALESCE(FLOOR(AVG(i.EndAt - c.CreateAt)), 0) as Average, (%v - c.CreateAt) / 86400000 as DayStarted", now)).
		From("IR_Incident as i").
		Join("Channels AS c ON (c.Id = i.ChannelId)").
		Where("i.EndAt != 0").
		GroupBy("DayStarted").
		OrderBy("DayStarted ASC")

	var averages []struct {
		Average    int
		DayStarted int
	}
	if err := s.store.selectBuilder(s.store.db, &averages, query); err != nil {
		s.log.Warnf("Unable to get average start to resoved %w", err)
		return []int{}
	}

	dayToAverage := make(map[int]int)
	for _, av := range averages {
		dayToAverage[av.DayStarted] = av.Average
	}

	days := make([]int, daysToQuery)
	for day := daysToQuery - 1; day >= 0; day-- {
		if val, ok := dayToAverage[day]; ok {
			days[day] = val
		} else {
			if day != daysToQuery-1 {
				days[day] = days[day+1]
			}
		}
	}

	return days
}
