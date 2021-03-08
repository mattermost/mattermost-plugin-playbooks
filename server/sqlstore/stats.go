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

type StatsFilters struct {
	TeamID string
}

func applyFilters(query sq.SelectBuilder, filters *StatsFilters) sq.SelectBuilder {
	return query.Where(sq.Eq{"i.TeamId": filters.TeamID})
}

func (s *StatsStore) TotalReportedIncidents(filters *StatsFilters) int {
	query := s.store.builder.
		Select("COUNT(ID)").
		From("IR_Incident as i").
		Where("CurrentStatus = 'Reported'")

	query = applyFilters(query, filters)

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		s.log.Warnf("Error retriving stat %w", err)
		return -1
	}

	return total
}

func (s *StatsStore) TotalActiveIncidents(filters *StatsFilters) int {
	query := s.store.builder.
		Select("COUNT(ID)").
		From("IR_Incident as i").
		Where("CurrentStatus = 'Active'")

	query = applyFilters(query, filters)

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		s.log.Warnf("Error retriving stat %w", err)
		return -1
	}

	return total
}

func (s *StatsStore) TotalActiveParticipants(filters *StatsFilters) int {
	query := s.store.builder.
		Select("COUNT(DISTINCT cm.UserId)").
		From("ChannelMembers as cm").
		Join("IR_Incident AS i ON i.ChannelId = cm.ChannelId").
		Where("i.EndAt = 0")

	query = applyFilters(query, filters)

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		s.log.Warnf("Error retriving stat %w", err)
		return -1
	}

	return total
}

func (s *StatsStore) AverageDurationActiveIncidentsMinutes(filters *StatsFilters) int {
	query := s.store.builder.
		Select("AVG(c.CreateAt)").
		From("IR_Incident AS i").
		Join("Channels AS c ON (c.Id = i.ChannelId)").
		Where("i.EndAt = 0")

	query = applyFilters(query, filters)

	var averageCreateAt float64
	if err := s.store.getBuilder(s.store.db, &averageCreateAt, query); err != nil {
		s.log.Warnf("Error retriving stat %w", err)
		return -1
	}

	return int((float64(model.GetMillis()) - averageCreateAt) / 60000)
}

// Not efficent. One query per day.
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

func (s *StatsStore) ActiveIncidents(filters *StatsFilters) []int {
	now := model.GetMillis()

	// Get the number of incidents started on each day
	startQuery := s.store.builder.
		Select(fmt.Sprintf("COUNT(i.Id), (%v - c.CreateAt) / 86400000 as DayStarted", now)).
		From("IR_Incident as i").
		Join("Channels AS c ON (c.Id = i.ChannelId)").
		GroupBy("DayStarted").
		OrderBy("DayStarted ASC")

	startQuery = applyFilters(startQuery, filters)

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

	// Get the number of incidents ended on each day
	endQuery := s.store.builder.
		Select(fmt.Sprintf("COUNT(i.Id), (%v - i.EndAt) / 86400000 as DayEnded", now)).
		From("IR_Incident as i").
		Where("i.EndAt != 0").
		GroupBy("DayEnded").
		OrderBy("DayEnded ASC")

	endQuery = applyFilters(endQuery, filters)

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

	// Get the current number of active incidents
	activeNowQuery := s.store.builder.
		Select("COUNT(i.Id)").
		From("IR_Incident as i").
		Where("i.EndAt = 0")

	activeNowQuery = applyFilters(activeNowQuery, filters)

	var activeNow int
	if err := s.store.getBuilder(s.store.db, &activeNow, activeNowQuery); err != nil {
		s.log.Warnf("Unable to get active now %w", err)
		return []int{}
	}

	// Derive the number of active incidents by starting wiht the currently active incidents
	// and using the tables above to calculate the number for each day.
	days := make([]int, 14)
	days[0] = activeNow
	for day := 1; day < 14; day++ {
		days[day] = days[day-1] + ended[day] - started[day-1]
	}

	return days
}

// Inefficent. Calculates the number of people in the incident using
// todays number of people in the incident, but counts it when the incident was created.
func (s *StatsStore) UniquePeopleInIncidents(filters *StatsFilters) []int {
	query := s.store.builder.
		Select("COUNT(DISTINCT cm.UserId)").
		From("ChannelMembers as cm").
		Join("IR_Incident AS i ON i.ChannelId = cm.ChannelId").
		Join("Channels AS c ON (c.Id = i.ChannelId)")

	query = applyFilters(query, filters)

	peopleInIncidents, err := s.MovingWindowQueryActive(query, 14)
	if err != nil {
		s.log.Warnf("Unable to get people in incidents %w", err)
		return []int{}
	}

	return peopleInIncidents
}

// Average times from CreateAt to the first non reported update for the last number of days.
// Averages are for incidents created on that day. Days with no created incidents use the last day.
func (s *StatsStore) AverageStartToActive(filters *StatsFilters) []int {
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

	query = applyFilters(query, filters)

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

// Average times from CreateAt to EndAt for the last number of days.
// Averages are for incidents created on that day. Days with no created incidents use the last day.
func (s *StatsStore) AverageStartToResolved(filters *StatsFilters) []int {
	daysToQuery := 42
	now := model.GetMillis()

	query := s.store.builder.
		Select(fmt.Sprintf("COALESCE(FLOOR(AVG(i.EndAt - c.CreateAt)), 0) as Average, (%v - c.CreateAt) / 86400000 as DayStarted", now)).
		From("IR_Incident as i").
		Join("Channels AS c ON (c.Id = i.ChannelId)").
		Where("i.EndAt != 0").
		GroupBy("DayStarted").
		OrderBy("DayStarted ASC")

	query = applyFilters(query, filters)

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
