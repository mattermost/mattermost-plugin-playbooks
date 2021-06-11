package sqlstore

import (
	"fmt"
	"time"

	"github.com/pkg/errors"

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
	TeamID     string
	PlaybookID string
}

func applyFilters(query sq.SelectBuilder, filters *StatsFilters) sq.SelectBuilder {
	ret := query

	if filters.TeamID != "" {
		ret = ret.Where(sq.Eq{"i.TeamID": filters.TeamID})
	}
	if filters.PlaybookID != "" {
		ret = ret.Where(sq.Eq{"i.PlaybookID": filters.PlaybookID})
	}

	return ret
}

func (s *StatsStore) TotalReportedPlaybookRuns(filters *StatsFilters) int {
	query := s.store.builder.
		Select("COUNT(ID)").
		From("IR_Incident as i").
		Where("CurrentStatus = 'Reported'")

	query = applyFilters(query, filters)

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		s.log.Warnf("Error retrieving stat total reported %w", err)
		return -1
	}

	return total
}

func (s *StatsStore) TotalActivePlaybookRuns(filters *StatsFilters) int {
	query := s.store.builder.
		Select("COUNT(ID)").
		From("IR_Incident as i").
		Where("CurrentStatus = 'Active'")

	query = applyFilters(query, filters)

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		s.log.Warnf("Error retrieving stat total active %w", err)
		return -1
	}

	return total
}

func (s *StatsStore) TotalInProgressPlaybookRuns(filters *StatsFilters) int {
	query := s.store.builder.
		Select("COUNT(i.ID)").
		From("IR_Incident as i").
		Where("i.EndAt = 0")

	query = applyFilters(query, filters)

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		s.log.Warnf("Error retrieving stat total in progress %w", err)
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
		s.log.Warnf("Error retrieving stat total active participants %w", err)
		return -1
	}

	return total
}

// RunsFinishedBetweenDays are calculated from startDay to endDay (inclusive), where "days"
// are "number of days ago". E.g., for the last 30 days, begin day would be 30 (days ago), end day
// would be 0 (days ago) (up until now).
func (s *StatsStore) RunsFinishedBetweenDays(filters *StatsFilters, startDay, endDay int) int {
	dayInMS := int64(86400000)
	startInMS := beginningOfTodayMillis() - int64(startDay)*dayInMS
	endInMS := endOfTodayMillis() - int64(endDay)*dayInMS

	query := s.store.builder.
		Select("COUNT(i.Id) as Count").
		From("IR_Incident as i").
		Where(sq.And{
			sq.Expr("i.EndAt > ?", startInMS),
			sq.Expr("i.EndAt <= ?", endInMS),
		})
	query = applyFilters(query, filters)

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		s.log.Warnf("Error retrieving stat total in progress %w", err)
		return -1
	}

	return total
}

func (s *StatsStore) AverageDurationActivePlaybookRunsMinutes(filters *StatsFilters) int {
	query := s.store.builder.
		Select("COALESCE(AVG(i.CreateAt), 0)").
		From("IR_Incident AS i").
		Where("i.EndAt = 0")

	query = applyFilters(query, filters)

	var averageCreateAt float64
	if err := s.store.getBuilder(s.store.db, &averageCreateAt, query); err != nil {
		s.log.Warnf("Error retrieving stat duration active %w", err)
		return -1
	}

	if averageCreateAt < 1.0 {
		return 0
	}

	return int((float64(model.GetMillis()) - averageCreateAt) / 60000)
}

// Not efficient. One query per day.
func (s *StatsStore) MovingWindowQueryActive(query sq.SelectBuilder, numDays int) ([]int, error) {
	now := model.GetMillis()
	dayInMS := int64(86400000)

	results := []int{}
	for i := 0; i < numDays; i++ {
		modifiedQuery := query.Where(
			sq.Expr(
				`i.CreateAt < ? AND (i.EndAt > ? OR i.EndAt = 0)`,
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

func (s *StatsStore) RunsStartedPerWeekLastXWeeks(x int, filters *StatsFilters) ([]int, []string) {
	day := int64(86400000)
	week := day * 7
	startOfWeek := beginningOfTodayMillis() - week
	endOfWeek := endOfTodayMillis()
	var weeksAsStrings []string

	q := s.store.builder.Select()
	for i := 0; i < x; i++ {
		if s.store.db.DriverName() == model.DATABASE_DRIVER_MYSQL {
			q = q.Column(`
                CAST(
                     SUM(
                         CASE
                             WHEN i.CreateAt <= ? AND i.CreateAt > ?
                                 THEN 1
                             ELSE 0
                         END)
                     AS UNSIGNED)
                 `, endOfWeek, startOfWeek)
		} else {
			q = q.Column(`
                SUM(CASE
                        WHEN i.CreateAt <= ? AND i.CreateAt > ?
                            THEN 1
                        ELSE 0
                    END)
                 `, endOfWeek, startOfWeek)
		}

		// use the middle of the day to get the date, just in case
		weekAsTime := time.Unix(0, (startOfWeek+day/2)*int64(time.Millisecond))
		weeksAsStrings = append(weeksAsStrings, weekAsTime.Format("02 Jan"))

		endOfWeek -= week
		startOfWeek -= week
	}

	q = q.From("IR_Incident as i")
	q = applyFilters(q, filters)

	counts, err := s.performQueryForXCols(q, x)
	if err != nil {
		s.log.Warnf("failed to perform query: %v", err)
		return []int{}, []string{}
	}

	return counts, weeksAsStrings
}

func (s *StatsStore) ActiveRunsPerDayLastXDays(x int, filters *StatsFilters) ([]int, []string) {
	startOfDay := beginningOfTodayMillis()
	endOfDay := endOfTodayMillis()
	day := int64(86400000)
	var daysAsStrings []string

	q := s.store.builder.Select()
	for i := 0; i < x; i++ {
		// a playbook run was active if it was created before the end of the day and ended after the
		// start of the day (or still active)
		if s.store.db.DriverName() == model.DATABASE_DRIVER_MYSQL {
			q = q.Column(`
                CAST(
                     SUM(
                         CASE
                             WHEN i.CreateAt <= ? AND (i.EndAt > ? OR i.EndAt = 0)
                                 THEN 1
                             ELSE 0
                         END)
                     AS UNSIGNED)
                `, endOfDay, startOfDay)
		} else {
			q = q.Column(`
                SUM(CASE
                        WHEN i.CreateAt <= ? AND (i.EndAt > ? OR i.EndAt = 0)
                            THEN 1
                        ELSE 0
                    END)
                `, endOfDay, startOfDay)
		}

		// use the middle of the day to get the date, just in case
		dayAsTime := time.Unix(0, (startOfDay+day/2)*int64(time.Millisecond))
		daysAsStrings = append(daysAsStrings, dayAsTime.Format("02 Jan"))

		endOfDay -= day
		startOfDay -= day
	}

	q = q.From("IR_Incident as i")
	q = applyFilters(q, filters)

	counts, err := s.performQueryForXCols(q, x)
	if err != nil {
		s.log.Warnf("failed to perform query: %v", err)
		return []int{}, []string{}
	}

	return counts, daysAsStrings
}

func (s *StatsStore) ActiveParticipantsPerDayLastXDays(x int, filters *StatsFilters) ([]int, []string) {
	startOfDay := beginningOfTodayMillis()
	endOfDay := endOfTodayMillis()
	day := int64(86400000)
	var daysAsStrings []string

	q := s.store.builder.Select()
	for i := 0; i < x; i++ {
		// COUNT( DISTINCT( CASE: the CASE will return the userId if the row satisfies the conditions,
		// therefore COUNT( DISTINCT will return the number of unique userIds
		//
		// first two lines of the WHEN: a playbook run was active if it was created before the
		// end of the day and ended after the start of the day (or still active)
		//
		// second two lines: a user was active in the same way--if they joined before the
		// end of the day and left after the start of the day (or are still in the channel)
		q = q.Column(`
                COUNT(DISTINCT
                      (CASE
                           WHEN i.CreateAt <= ? AND
                                (i.EndAt > ? OR i.EndAt = 0) AND
                                cmh.JoinTime <= ? AND
                                (cmh.LeaveTime > ? OR cmh.LeaveTime is NULL)
                               THEN cmh.UserId
                      END))
                `, endOfDay, startOfDay, endOfDay, startOfDay)

		// use the middle of the day to get the date, just in case
		dayAsTime := time.Unix(0, (startOfDay+day/2)*int64(time.Millisecond))
		daysAsStrings = append(daysAsStrings, dayAsTime.Format("02 Jan"))

		endOfDay -= day
		startOfDay -= day
	}

	q = q.
		From("IR_Incident as i").
		InnerJoin("ChannelMemberHistory as cmh ON i.ChannelId = cmh.ChannelId")
	q = applyFilters(q, filters)

	counts, err := s.performQueryForXCols(q, x)
	if err != nil {
		s.log.Warnf("failed to perform query: %v", err)
		return []int{}, []string{}
	}

	return counts, daysAsStrings
}

func (s *StatsStore) performQueryForXCols(q sq.SelectBuilder, x int) ([]int, error) {
	sqlString, args, err := q.ToSql()
	if err != nil {
		return []int{}, errors.Wrap(err, "failed to build sql")
	}
	sqlString = s.store.db.Rebind(sqlString)

	rows, err := s.store.db.Queryx(sqlString, args...)
	if err != nil {
		return []int{}, errors.Wrap(err, "failed to get rows from Queryx")
	}

	defer rows.Close()
	if !rows.Next() {
		return []int{}, errors.Wrap(rows.Err(), "failed to get rows.Next()")
	}

	cols, err2 := rows.SliceScan()
	if err2 != nil {
		return []int{}, errors.Wrap(err, "failed to get SliceScan")
	}
	if len(cols) != x {
		return []int{}, fmt.Errorf("failed to get correct length for columns, wanted %d, got %d", x, len(cols))
	}

	counts := make([]int, x)
	for i := 0; i < x; i++ {
		val, ok := cols[i].(int64)
		if !ok {
			return []int{}, fmt.Errorf("column was unexpected type, wanted int64, got: %T", cols[i])
		}
		counts[i] = int(val)
	}

	return counts, nil
}

func (s *StatsStore) CountActivePlaybookRunsByDay(filters *StatsFilters) []int {
	now := model.GetMillis()

	// Get the number of playbook runs started on each day
	startQuery := s.store.builder.
		Select(fmt.Sprintf("COUNT(i.Id) as Count, FLOOR((%v - i.CreateAt) / 86400000) as DayStarted", now)).
		From("IR_Incident as i").
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

	// Get the number of playbook runs ended on each day
	endQuery := s.store.builder.
		Select(fmt.Sprintf("COUNT(i.Id) as Count, FLOOR((%v - i.EndAt) / 86400000) as DayEnded", now)).
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

	// Get the current number of active playbook runs.
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

	// Derive the number of active playbook runs by starting with the currently active playbook runs
	// and using the tables above to calculate the number for each day.
	days := make([]int, 14)
	days[0] = activeNow
	for day := 1; day < 14; day++ {
		days[day] = days[day-1] + ended[day] - started[day-1]
	}

	return days
}

// Inefficient. Calculates the number of people in the playbook run using
// today's number of people in the playbook run, but counts it when the playbook run was created.
func (s *StatsStore) UniquePeopleInPlaybookRuns(filters *StatsFilters) []int {
	query := s.store.builder.
		Select("COUNT(DISTINCT cm.UserId)").
		From("ChannelMembers as cm").
		Join("IR_Incident AS i ON i.ChannelId = cm.ChannelId")

	query = applyFilters(query, filters)

	peopleInPlaybookRuns, err := s.MovingWindowQueryActive(query, 14)
	if err != nil {
		s.log.Warnf("Unable to get people in playbook runs %w", err)
		return []int{}
	}

	return peopleInPlaybookRuns
}

// Average times from CreateAt to the first non-"Reported" update for the last number of days.
// Averages are for playbook runs created on that day. Days with no created playbook runs use the last day.
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
		Select(fmt.Sprintf("COALESCE(FLOOR(AVG(%s - i.CreateAt)), 0) as Average, FLOOR((%v - i.CreateAt) / 86400000) as DayStarted", firstNonReportedStatusPost, now)).
		From("IR_Incident as i").
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
// Averages are for playbook runs created on that day. Days with no created playbook runs use the last day.
func (s *StatsStore) AverageStartToResolved(filters *StatsFilters) []int {
	daysToQuery := 42
	now := model.GetMillis()

	query := s.store.builder.
		Select(fmt.Sprintf("COALESCE(FLOOR(AVG(i.EndAt - c.CreateAt)), 0) as Average, FLOOR((%v - c.CreateAt) / 86400000) as DayStarted", now)).
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

func beginningOfTodayMillis() int64 {
	year, month, day := time.Now().UTC().Date()
	bod := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
	return bod.UnixNano() / int64(time.Millisecond)
}

func endOfTodayMillis() int64 {
	year, month, day := time.Now().UTC().Add(24 * time.Hour).Date()
	bod := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
	return bod.UnixNano() / int64(time.Millisecond)
}
