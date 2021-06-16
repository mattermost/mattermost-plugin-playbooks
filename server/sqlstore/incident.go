package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/lib/pq"

	"github.com/jmoiron/sqlx"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const (
	legacyEventTypeCommanderChanged = "commander_changed"
)

type sqlIncident struct {
	app.Incident
	ChecklistsJSON              json.RawMessage
	ConcatenatedInvitedUserIDs  string
	ConcatenatedInvitedGroupIDs string
}

// incidentStore holds the information needed to fulfill the methods in the store interface.
type incidentStore struct {
	pluginAPI            PluginAPIClient
	log                  bot.Logger
	store                *SQLStore
	queryBuilder         sq.StatementBuilderType
	incidentSelect       sq.SelectBuilder
	statusPostsSelect    sq.SelectBuilder
	timelineEventsSelect sq.SelectBuilder
}

// Ensure incidentStore implements the app.IncidentStore interface.
var _ app.IncidentStore = (*incidentStore)(nil)

type incidentStatusPosts []struct {
	IncidentID string
	app.StatusPost
}

func applyIncidentFilterOptionsSort(builder sq.SelectBuilder, options app.IncidentFilterOptions) (sq.SelectBuilder, error) {
	var sort string
	switch options.Sort {
	case app.SortByCreateAt:
		sort = "CreateAt"
	case app.SortByID:
		sort = "ID"
	case app.SortByName:
		sort = "Name"
	case app.SortByOwnerUserID:
		sort = "OwnerUserID"
	case app.SortByTeamID:
		sort = "TeamID"
	case app.SortByEndAt:
		sort = "EndAt"
	case app.SortByStatus:
		sort = "CurrentStatus"
	case app.SortByLastUpdateAt:
		sort = "LastUpdateAt"
	case "":
		// Default to a stable sort if none explicitly provided.
		sort = "ID"
	default:
		return sq.SelectBuilder{}, errors.Errorf("unsupported sort parameter '%s'", options.Sort)
	}

	var direction string
	switch options.Direction {
	case app.DirectionAsc:
		direction = "ASC"
	case app.DirectionDesc:
		direction = "DESC"
	case "":
		// Default to an ascending sort if none explicitly provided.
		direction = "ASC"
	default:
		return sq.SelectBuilder{}, errors.Errorf("unsupported direction parameter '%s'", options.Direction)
	}

	builder = builder.OrderByClause(fmt.Sprintf("%s %s", sort, direction))

	page := options.Page
	perPage := options.PerPage
	if page < 0 {
		page = 0
	}
	if perPage < 0 {
		perPage = 0
	}

	builder = builder.
		Offset(uint64(page * perPage)).
		Limit(uint64(perPage))

	return builder, nil
}

// NewIncidentStore creates a new store for incident ServiceImpl.
func NewIncidentStore(pluginAPI PluginAPIClient, log bot.Logger, sqlStore *SQLStore) app.IncidentStore {
	// When adding an Incident column #1: add to this select
	incidentSelect := sqlStore.builder.
		Select("i.ID", "c.DisplayName AS Name", "i.Description", "i.CommanderUserID AS OwnerUserID", "i.TeamID", "i.ChannelID",
			"i.CreateAt", "i.EndAt", "i.DeleteAt", "i.PostID", "i.PlaybookID", "i.ReporterUserID", "i.CurrentStatus", "i.LastUpdateAt",
			"i.ChecklistsJSON", "COALESCE(i.ReminderPostID, '') ReminderPostID", "i.PreviousReminder", "i.BroadcastChannelID",
			"COALESCE(ReminderMessageTemplate, '') ReminderMessageTemplate", "ConcatenatedInvitedUserIDs", "ConcatenatedInvitedGroupIDs", "DefaultCommanderID AS DefaultOwnerID",
			"AnnouncementChannelID", "WebhookOnCreationURL", "Retrospective", "MessageOnJoin", "RetrospectivePublishedAt", "RetrospectiveReminderIntervalSeconds",
			"RetrospectiveWasCanceled", "WebhookOnStatusUpdateURL").
		From("IR_Incident AS i").
		Join("Channels AS c ON (c.Id = i.ChannelId)")

	statusPostsSelect := sqlStore.builder.
		Select("sp.IncidentID", "p.ID", "p.CreateAt", "p.DeleteAt", "sp.Status").
		From("IR_StatusPosts as sp").
		Join("Posts as p ON sp.PostID = p.Id")

	timelineEventsSelect := sqlStore.builder.
		Select(
			"te.ID",
			"te.IncidentID",
			"te.CreateAt",
			"te.DeleteAt",
			"te.EventAt",
		).
		// Map "commander_changed" to "owner_changed", preserving database compatibility
		// without complicating the code.
		Column(
			sq.Alias(
				sq.Case().
					When(sq.Eq{"te.EventType": legacyEventTypeCommanderChanged}, sq.Expr("?", app.OwnerChanged)).
					Else("te.EventType"),
				"EventType",
			),
		).
		Columns(
			"te.Summary",
			"te.Details",
			"te.PostID",
			"te.SubjectUserID",
			"te.CreatorUserID",
		).
		From("IR_TimelineEvent as te")

	return &incidentStore{
		pluginAPI:            pluginAPI,
		log:                  log,
		store:                sqlStore,
		queryBuilder:         sqlStore.builder,
		incidentSelect:       incidentSelect,
		statusPostsSelect:    statusPostsSelect,
		timelineEventsSelect: timelineEventsSelect,
	}
}

// GetIncidents returns filtered incidents and the total count before paging.
func (s *incidentStore) GetIncidents(requesterInfo app.RequesterInfo, options app.IncidentFilterOptions) (*app.GetIncidentsResults, error) {
	permissionsExpr := s.buildPermissionsExpr(requesterInfo)

	queryForResults := s.incidentSelect.
		Where(permissionsExpr).
		Where(sq.Eq{"i.TeamID": options.TeamID})

	queryForTotal := s.store.builder.
		Select("COUNT(*)").
		From("IR_Incident AS i").
		Join("Channels AS c ON (c.Id = i.ChannelId)").
		Where(permissionsExpr).
		Where(sq.Eq{"i.TeamID": options.TeamID})

	if options.Status != "" && len(options.Statuses) != 0 {
		return nil, errors.New("options Status and Statuses cannot both be set")
	}

	if options.Status != "" {
		queryForResults = queryForResults.Where(sq.Eq{"i.CurrentStatus": options.Status})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.CurrentStatus": options.Status})
	}

	if len(options.Statuses) != 0 {
		queryForResults = queryForResults.Where(sq.Eq{"i.CurrentStatus": options.Statuses})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.CurrentStatus": options.Statuses})
	}

	if options.OwnerID != "" {
		queryForResults = queryForResults.Where(sq.Eq{"i.CommanderUserID": options.OwnerID})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.CommanderUserID": options.OwnerID})
	}

	if options.MemberID != "" {
		membershipClause := s.queryBuilder.
			Select("1").
			Prefix("EXISTS(").
			From("ChannelMembers AS cm").
			Where("cm.ChannelId = i.ChannelID").
			Where(sq.Eq{"cm.UserId": strings.ToLower(options.MemberID)}).
			Suffix(")")

		queryForResults = queryForResults.Where(membershipClause)
		queryForTotal = queryForTotal.Where(membershipClause)
	}

	if options.PlaybookID != "" {
		queryForResults = queryForResults.Where(sq.Eq{"i.PlaybookID": options.PlaybookID})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.PlaybookID": options.PlaybookID})
	}

	// TODO: do we need to sanitize (replace any '%'s in the search term)?
	if options.SearchTerm != "" {
		column := "c.DisplayName"
		searchString := options.SearchTerm

		// Postgres performs a case-sensitive search, so we need to lowercase
		// both the column contents and the search string
		if s.store.db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			column = "LOWER(c.DisplayName)"
			searchString = strings.ToLower(options.SearchTerm)
		}

		queryForResults = queryForResults.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
		queryForTotal = queryForTotal.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
	}

	if options.ActiveGTE > 0 && options.ActiveLT > 0 {
		queryForResults = queryActiveBetweenTimes(queryForResults, options.ActiveGTE, options.ActiveLT)
		queryForTotal = queryActiveBetweenTimes(queryForTotal, options.ActiveGTE, options.ActiveLT)
	} else if options.ActiveGTE > 0 {
		queryForResults = queryActiveBetweenTimes(queryForResults, options.ActiveGTE, model.GetMillis())
		queryForTotal = queryActiveBetweenTimes(queryForTotal, options.ActiveGTE, model.GetMillis())
	} else if options.ActiveLT > 0 {
		queryForResults = queryActiveBetweenTimes(queryForResults, 0, options.ActiveLT)
		queryForTotal = queryActiveBetweenTimes(queryForTotal, 0, options.ActiveLT)
	}

	if options.StartedGTE > 0 && options.StartedLT > 0 {
		queryForResults = queryStartedBetweenTimes(queryForResults, options.StartedGTE, options.StartedLT)
		queryForTotal = queryStartedBetweenTimes(queryForTotal, options.StartedGTE, options.StartedLT)
	} else if options.StartedGTE > 0 {
		queryForResults = queryStartedBetweenTimes(queryForResults, options.StartedGTE, model.GetMillis())
		queryForTotal = queryStartedBetweenTimes(queryForTotal, options.StartedGTE, model.GetMillis())
	} else if options.StartedLT > 0 {
		queryForResults = queryStartedBetweenTimes(queryForResults, 0, options.StartedLT)
		queryForTotal = queryStartedBetweenTimes(queryForTotal, 0, options.StartedLT)
	}

	queryForResults, err := applyIncidentFilterOptionsSort(queryForResults, options)
	if err != nil {
		return nil, errors.Wrap(err, "failed to apply sort options")
	}

	tx, err := s.store.db.Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	var rawIncidents []sqlIncident
	if err = s.store.selectBuilder(tx, &rawIncidents, queryForResults); err != nil {
		return nil, errors.Wrap(err, "failed to query for incidents")
	}

	var total int
	if err = s.store.getBuilder(tx, &total, queryForTotal); err != nil {
		return nil, errors.Wrap(err, "failed to get total count")
	}
	pageCount := 0
	if options.PerPage > 0 {
		pageCount = int(math.Ceil(float64(total) / float64(options.PerPage)))
	}
	hasMore := options.Page+1 < pageCount

	incidents := make([]app.Incident, 0, len(rawIncidents))
	incidentIDs := make([]string, 0, len(rawIncidents))
	for _, rawIncident := range rawIncidents {
		var incident *app.Incident
		incident, err = s.toIncident(rawIncident)
		if err != nil {
			return nil, err
		}
		incidents = append(incidents, *incident)
		incidentIDs = append(incidentIDs, incident.ID)
	}

	var statusPosts incidentStatusPosts

	postInfoSelect := s.statusPostsSelect.
		OrderBy("p.CreateAt").
		Where(sq.Eq{"sp.IncidentID": incidentIDs})

	err = s.store.selectBuilder(tx, &statusPosts, postInfoSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrap(err, "failed to get incidentStatusPosts")
	}

	timelineEvents, err := s.getTimelineEventsForIncident(tx, incidentIDs)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "could not commit transaction")
	}

	addStatusPostsToIncidents(statusPosts, incidents)
	addTimelineEventsToIncidents(timelineEvents, incidents)

	return &app.GetIncidentsResults{
		TotalCount: total,
		PageCount:  pageCount,
		HasMore:    hasMore,
		Items:      incidents,
	}, nil
}

// CreateIncident creates a new incident. If incident has an ID, that ID will be used.
func (s *incidentStore) CreateIncident(incident *app.Incident) (*app.Incident, error) {
	if incident == nil {
		return nil, errors.New("incident is nil")
	}
	incident = incident.Clone()

	if incident.ID == "" {
		incident.ID = model.NewId()
	}

	rawIncident, err := toSQLIncident(*incident)
	if err != nil {
		return nil, err
	}

	// When adding an Incident column #2: add to the SetMap
	_, err = s.store.execBuilder(s.store.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":                                   rawIncident.ID,
			"Name":                                 rawIncident.Name,
			"Description":                          rawIncident.Description,
			"CommanderUserID":                      rawIncident.OwnerUserID,
			"ReporterUserID":                       rawIncident.ReporterUserID,
			"TeamID":                               rawIncident.TeamID,
			"ChannelID":                            rawIncident.ChannelID,
			"CreateAt":                             rawIncident.CreateAt,
			"EndAt":                                rawIncident.EndAt,
			"PostID":                               rawIncident.PostID,
			"PlaybookID":                           rawIncident.PlaybookID,
			"ChecklistsJSON":                       rawIncident.ChecklistsJSON,
			"ReminderPostID":                       rawIncident.ReminderPostID,
			"PreviousReminder":                     rawIncident.PreviousReminder,
			"BroadcastChannelID":                   rawIncident.BroadcastChannelID,
			"ReminderMessageTemplate":              rawIncident.ReminderMessageTemplate,
			"CurrentStatus":                        rawIncident.CurrentStatus,
			"LastUpdateAt":                         rawIncident.LastUpdateAt,
			"ConcatenatedInvitedUserIDs":           rawIncident.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs":          rawIncident.ConcatenatedInvitedGroupIDs,
			"DefaultCommanderID":                   rawIncident.DefaultOwnerID,
			"AnnouncementChannelID":                rawIncident.AnnouncementChannelID,
			"WebhookOnCreationURL":                 rawIncident.WebhookOnCreationURL,
			"Retrospective":                        rawIncident.Retrospective,
			"RetrospectivePublishedAt":             rawIncident.RetrospectivePublishedAt,
			"MessageOnJoin":                        rawIncident.MessageOnJoin,
			"RetrospectiveReminderIntervalSeconds": rawIncident.RetrospectiveReminderIntervalSeconds,
			"RetrospectiveWasCanceled":             rawIncident.RetrospectiveWasCanceled,
			"WebhookOnStatusUpdateURL":             rawIncident.WebhookOnStatusUpdateURL,
			// Preserved for backwards compatibility with v1.2
			"ActiveStage":      0,
			"ActiveStageTitle": "",
			"IsActive":         true,
			"DeleteAt":         0,
		}))

	if err != nil {
		return nil, errors.Wrapf(err, "failed to store new incident")
	}

	return incident, nil
}

// UpdateIncident updates an incident.
func (s *incidentStore) UpdateIncident(incident *app.Incident) error {
	if incident == nil {
		return errors.New("incident is nil")
	}
	if incident.ID == "" {
		return errors.New("ID should not be empty")
	}

	rawIncident, err := toSQLIncident(*incident)
	if err != nil {
		return err
	}

	// When adding an Incident column #3: add to this SetMap (if it is a column that can be updated)
	_, err = s.store.execBuilder(s.store.db, sq.
		Update("IR_Incident").
		SetMap(map[string]interface{}{
			"Name":                                 "",
			"Description":                          rawIncident.Description,
			"CommanderUserID":                      rawIncident.OwnerUserID,
			"LastUpdateAt":                         rawIncident.LastUpdateAt,
			"ChecklistsJSON":                       rawIncident.ChecklistsJSON,
			"ReminderPostID":                       rawIncident.ReminderPostID,
			"PreviousReminder":                     rawIncident.PreviousReminder,
			"BroadcastChannelID":                   rawIncident.BroadcastChannelID,
			"EndAt":                                rawIncident.ResolvedAt(),
			"ConcatenatedInvitedUserIDs":           rawIncident.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs":          rawIncident.ConcatenatedInvitedGroupIDs,
			"DefaultCommanderID":                   rawIncident.DefaultOwnerID,
			"AnnouncementChannelID":                rawIncident.AnnouncementChannelID,
			"WebhookOnCreationURL":                 rawIncident.WebhookOnCreationURL,
			"Retrospective":                        rawIncident.Retrospective,
			"RetrospectivePublishedAt":             rawIncident.RetrospectivePublishedAt,
			"MessageOnJoin":                        rawIncident.MessageOnJoin,
			"RetrospectiveReminderIntervalSeconds": rawIncident.RetrospectiveReminderIntervalSeconds,
			"RetrospectiveWasCanceled":             rawIncident.RetrospectiveWasCanceled,
			"WebhookOnStatusUpdateURL":             rawIncident.WebhookOnStatusUpdateURL,
		}).
		Where(sq.Eq{"ID": rawIncident.ID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update incident with id '%s'", rawIncident.ID)
	}

	return nil
}

func (s *incidentStore) UpdateStatus(statusPost *app.SQLStatusPost) error {
	if statusPost == nil {
		return errors.New("status post is nil")
	}
	if statusPost.IncidentID == "" {
		return errors.New("needs incident ID")
	}
	if statusPost.PostID == "" {
		return errors.New("needs post ID")
	}
	if statusPost.Status == "" {
		return errors.New("needs status")
	}

	if _, err := s.store.execBuilder(s.store.db, sq.
		Insert("IR_StatusPosts").
		SetMap(map[string]interface{}{
			"IncidentID": statusPost.IncidentID,
			"PostID":     statusPost.PostID,
			"Status":     statusPost.Status,
		})); err != nil {
		return errors.Wrap(err, "failed to add new status post")
	}

	if _, err := s.store.execBuilder(s.store.db, sq.
		Update("IR_Incident").
		SetMap(map[string]interface{}{
			"CurrentStatus": statusPost.Status,
			"EndAt":         statusPost.EndAt,
		}).
		Where(sq.Eq{"ID": statusPost.IncidentID})); err != nil {
		return errors.Wrap(err, "failed to update current status")
	}

	return nil
}

// CreateTimelineEvent creates the timeline event
func (s *incidentStore) CreateTimelineEvent(event *app.TimelineEvent) (*app.TimelineEvent, error) {
	if event.IncidentID == "" {
		return nil, errors.New("needs incident ID")
	}
	if event.EventType == "" {
		return nil, errors.New("needs event type")
	}
	if event.CreateAt == 0 {
		event.CreateAt = model.GetMillis()
	}
	event.ID = model.NewId()

	eventType := string(event.EventType)
	if event.EventType == app.OwnerChanged {
		eventType = legacyEventTypeCommanderChanged
	}

	_, err := s.store.execBuilder(s.store.db, sq.
		Insert("IR_TimelineEvent").
		SetMap(map[string]interface{}{
			"ID":            event.ID,
			"IncidentID":    event.IncidentID,
			"CreateAt":      event.CreateAt,
			"DeleteAt":      event.DeleteAt,
			"EventAt":       event.EventAt,
			"EventType":     eventType,
			"Summary":       event.Summary,
			"Details":       event.Details,
			"PostID":        event.PostID,
			"SubjectUserID": event.SubjectUserID,
			"CreatorUserID": event.CreatorUserID,
		}))

	if err != nil {
		return nil, errors.Wrap(err, "failed to insert timeline event")
	}

	return event, nil
}

// UpdateTimelineEvent updates (or inserts) the timeline event
func (s *incidentStore) UpdateTimelineEvent(event *app.TimelineEvent) error {
	if event.ID == "" {
		return errors.New("needs event ID")
	}
	if event.IncidentID == "" {
		return errors.New("needs incident ID")
	}
	if event.EventType == "" {
		return errors.New("needs event type")
	}

	eventType := string(event.EventType)
	if event.EventType == app.OwnerChanged {
		eventType = legacyEventTypeCommanderChanged
	}

	_, err := s.store.execBuilder(s.store.db, sq.
		Update("IR_TimelineEvent").
		SetMap(map[string]interface{}{
			"IncidentID":    event.IncidentID,
			"CreateAt":      event.CreateAt,
			"DeleteAt":      event.DeleteAt,
			"EventAt":       event.EventAt,
			"EventType":     eventType,
			"Summary":       event.Summary,
			"Details":       event.Details,
			"PostID":        event.PostID,
			"SubjectUserID": event.SubjectUserID,
			"CreatorUserID": event.CreatorUserID,
		}).
		Where(sq.Eq{"ID": event.ID}))

	if err != nil {
		return errors.Wrap(err, "failed to update timeline event")
	}

	return nil
}

// GetIncident gets an incident by ID.
func (s *incidentStore) GetIncident(incidentID string) (*app.Incident, error) {
	if incidentID == "" {
		return nil, errors.New("ID cannot be empty")
	}

	tx, err := s.store.db.Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	var rawIncident sqlIncident
	err = s.store.getBuilder(tx, &rawIncident, s.incidentSelect.Where(sq.Eq{"i.ID": incidentID}))
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(app.ErrNotFound, "incident with id '%s' does not exist", incidentID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get incident by id '%s'", incidentID)
	}

	incident, err := s.toIncident(rawIncident)
	if err != nil {
		return nil, err
	}

	var statusPosts incidentStatusPosts

	postInfoSelect := s.statusPostsSelect.
		Where(sq.Eq{"sp.IncidentID": incidentID}).
		OrderBy("p.CreateAt")

	err = s.store.selectBuilder(tx, &statusPosts, postInfoSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrapf(err, "failed to get incidentStatusPosts for incident with id '%s'", incidentID)
	}

	timelineEvents, err := s.getTimelineEventsForIncident(tx, []string{incidentID})
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "could not commit transaction")
	}

	for _, p := range statusPosts {
		incident.StatusPosts = append(incident.StatusPosts, p.StatusPost)
	}

	incident.TimelineEvents = append(incident.TimelineEvents, timelineEvents...)

	return incident, nil
}

func (s *incidentStore) getTimelineEventsForIncident(q sqlx.Queryer, incidentIDs []string) ([]app.TimelineEvent, error) {
	var timelineEvents []app.TimelineEvent

	timelineEventsSelect := s.timelineEventsSelect.
		OrderBy("te.EventAt ASC").
		Where(sq.And{sq.Eq{"te.IncidentID": incidentIDs}, sq.Eq{"te.DeleteAt": 0}})

	err := s.store.selectBuilder(q, &timelineEvents, timelineEventsSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrap(err, "failed to get timelineEvents")
	}

	return timelineEvents, nil
}

// GetTimelineEvent returns the timeline event for incidentID by the timeline event ID.
func (s *incidentStore) GetTimelineEvent(incidentID, eventID string) (*app.TimelineEvent, error) {
	var event app.TimelineEvent

	timelineEventSelect := s.timelineEventsSelect.
		Where(sq.And{sq.Eq{"te.IncidentID": incidentID}, sq.Eq{"te.ID": eventID}})

	err := s.store.getBuilder(s.store.db, &event, timelineEventSelect)
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(app.ErrNotFound, "timeline event with id (%s) does not exist for incident with id (%s)", eventID, incidentID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get timeline event with id (%s) for incident with id (%s)", eventID, incidentID)
	}

	return &event, nil
}

// GetIncidentIDForChannel gets the incidentID associated with the given channelID.
func (s *incidentStore) GetIncidentIDForChannel(channelID string) (string, error) {
	query := s.queryBuilder.
		Select("i.ID").
		From("IR_Incident i").
		Where(sq.Eq{"i.ChannelID": channelID})

	var id string
	err := s.store.getBuilder(s.store.db, &id, query)
	if err == sql.ErrNoRows {
		return "", errors.Wrapf(app.ErrNotFound, "channel with id (%s) does not have an incident", channelID)
	} else if err != nil {
		return "", errors.Wrapf(err, "failed to get incident by channelID '%s'", channelID)
	}

	return id, nil
}

// GetAllIncidentMembersCount returns the count of all members of an incident since the
// beginning of the incident, excluding bots.
func (s *incidentStore) GetAllIncidentMembersCount(channelID string) (int64, error) {
	query := s.queryBuilder.
		Select("COUNT(DISTINCT cmh.UserId)").
		From("ChannelMemberHistory AS cmh").
		Where(sq.Eq{"cmh.ChannelId": channelID}).
		Where(sq.Expr("cmh.UserId NOT IN (SELECT UserId FROM Bots)"))

	var numMembers int64
	err := s.store.getBuilder(s.store.db, &numMembers, query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to query database")
	}

	return numMembers, nil
}

// GetOwners returns the owners of the incidents selected by options
func (s *incidentStore) GetOwners(requesterInfo app.RequesterInfo, options app.IncidentFilterOptions) ([]app.OwnerInfo, error) {
	permissionsExpr := s.buildPermissionsExpr(requesterInfo)

	// At the moment, the options only includes teamID
	query := s.queryBuilder.
		Select("DISTINCT u.Id AS UserID", "u.Username").
		From("IR_Incident AS i").
		Join("Users AS u ON i.CommanderUserID = u.Id").
		Where(sq.Eq{"i.TeamID": options.TeamID}).
		Where(permissionsExpr)

	var owners []app.OwnerInfo
	err := s.store.selectBuilder(s.store.db, &owners, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query database")
	}

	return owners, nil
}

// NukeDB removes all incident related data.
func (s *incidentStore) NukeDB() (err error) {
	tx, err := s.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	if _, err := tx.Exec("DROP TABLE IF EXISTS IR_PlaybookMember,  IR_StatusPosts, IR_Incident, IR_Playbook, IR_System, IR_TimelineEvent"); err != nil {
		return errors.Wrap(err, "could not delete all IR tables")
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit")
	}

	return s.store.RunMigrations()
}

func (s *incidentStore) ChangeCreationDate(incidentID string, creationTimestamp time.Time) error {
	updateQuery := s.queryBuilder.Update("IR_Incident").
		Where(sq.Eq{"ID": incidentID}).
		Set("CreateAt", model.GetMillisForTime(creationTimestamp))

	sqlResult, err := s.store.execBuilder(s.store.db, updateQuery)
	if err != nil {
		return errors.Wrapf(err, "unable to execute the update query")
	}

	numRows, err := sqlResult.RowsAffected()
	if err != nil {
		return errors.Wrapf(err, "unable to check how many rows were updated")
	}

	if numRows == 0 {
		return app.ErrNotFound
	}

	return nil
}

// HasViewed returns true if userID has viewed channelID
func (s *incidentStore) HasViewedChannel(userID, channelID string) bool {
	query := sq.Expr(
		`SELECT EXISTS(SELECT *
                         FROM IR_ViewedChannel as vc
                        WHERE vc.ChannelID = ?
                          AND vc.UserID = ?)
             `, channelID, userID)

	var exists bool
	err := s.store.getBuilder(s.store.db, &exists, query)
	if err != nil {
		return false
	}

	return exists
}

// SetViewed records that userID has viewed channelID.
func (s *incidentStore) SetViewedChannel(userID, channelID string) error {
	if s.HasViewedChannel(userID, channelID) {
		return nil
	}

	_, err := s.store.execBuilder(s.store.db, sq.
		Insert("IR_ViewedChannel").
		SetMap(map[string]interface{}{
			"ChannelID": channelID,
			"UserID":    userID,
		}))

	if err != nil {
		if s.store.db.DriverName() == model.DATABASE_DRIVER_MYSQL {
			me, ok := err.(*mysql.MySQLError)
			if ok && me.Number == 1062 {
				return errors.Wrap(app.ErrDuplicateEntry, err.Error())
			}
		} else {
			pe, ok := err.(*pq.Error)
			if ok && pe.Code == "23505" {
				return errors.Wrap(app.ErrDuplicateEntry, err.Error())
			}
		}

		return errors.Wrapf(err, "failed to store userID and channelID")
	}

	return nil
}

func (s *incidentStore) buildPermissionsExpr(info app.RequesterInfo) sq.Sqlizer {
	if info.IsAdmin {
		return nil
	}

	// Guests must be channel members
	if info.IsGuest {
		return sq.Expr(`
			  EXISTS(SELECT 1
						 FROM ChannelMembers as cm
						 WHERE cm.ChannelId = i.ChannelID
						   AND cm.UserId = ?)
		`, info.UserID)
	}

	// is the requester a channel member, or is the channel public?
	return sq.Expr(`
		  (
			  -- If requester is a channel member
			  EXISTS(SELECT 1
						 FROM ChannelMembers as cm
						 WHERE cm.ChannelId = i.ChannelID
						   AND cm.UserId = ?)
			  -- Or if channel is public
			  OR EXISTS(SELECT 1
							FROM Channels as c
							WHERE c.Id = i.ChannelID
							  AND c.Type = 'O')
		  )`, info.UserID)
}

func (s *incidentStore) toIncident(rawIncident sqlIncident) (*app.Incident, error) {
	incident := rawIncident.Incident
	if err := json.Unmarshal(rawIncident.ChecklistsJSON, &incident.Checklists); err != nil {
		return nil, errors.Wrapf(err, "failed to unmarshal checklists json for incident id: %s", rawIncident.ID)
	}

	incident.InvitedUserIDs = []string(nil)
	if rawIncident.ConcatenatedInvitedUserIDs != "" {
		incident.InvitedUserIDs = strings.Split(rawIncident.ConcatenatedInvitedUserIDs, ",")
	}

	incident.InvitedGroupIDs = []string(nil)
	if rawIncident.ConcatenatedInvitedGroupIDs != "" {
		incident.InvitedGroupIDs = strings.Split(rawIncident.ConcatenatedInvitedGroupIDs, ",")
	}

	return &incident, nil
}

func toSQLIncident(incident app.Incident) (*sqlIncident, error) {
	newChecklists := populateChecklistIDs(incident.Checklists)
	checklistsJSON, err := checklistsToJSON(newChecklists)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal checklist json for incident id: '%s'", incident.ID)
	}

	return &sqlIncident{
		Incident:                    incident,
		ChecklistsJSON:              checklistsJSON,
		ConcatenatedInvitedUserIDs:  strings.Join(incident.InvitedUserIDs, ","),
		ConcatenatedInvitedGroupIDs: strings.Join(incident.InvitedGroupIDs, ","),
	}, nil
}

// populateChecklistIDs returns a cloned slice with ids entered for checklists and checklist items.
func populateChecklistIDs(checklists []app.Checklist) []app.Checklist {
	if len(checklists) == 0 {
		return nil
	}

	newChecklists := make([]app.Checklist, len(checklists))
	for i, c := range checklists {
		newChecklists[i] = c.Clone()
		if newChecklists[i].ID == "" {
			newChecklists[i].ID = model.NewId()
		}
		for j, item := range newChecklists[i].Items {
			if item.ID == "" {
				newChecklists[i].Items[j].ID = model.NewId()
			}
		}
	}

	return newChecklists
}

// An incident needs to assign unique ids to its checklist items
func checklistsToJSON(checklists []app.Checklist) (json.RawMessage, error) {
	checklistsJSON, err := json.Marshal(checklists)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal checklist json")
	}

	return checklistsJSON, nil
}

func addStatusPostsToIncidents(statusIDs incidentStatusPosts, incidents []app.Incident) {
	iToPosts := make(map[string][]app.StatusPost)
	for _, p := range statusIDs {
		iToPosts[p.IncidentID] = append(iToPosts[p.IncidentID], p.StatusPost)
	}
	for i, incident := range incidents {
		incidents[i].StatusPosts = iToPosts[incident.ID]
	}
}

func addTimelineEventsToIncidents(timelineEvents []app.TimelineEvent, incidents []app.Incident) {
	iToTe := make(map[string][]app.TimelineEvent)
	for _, te := range timelineEvents {
		iToTe[te.IncidentID] = append(iToTe[te.IncidentID], te)
	}
	for i, incident := range incidents {
		incidents[i].TimelineEvents = iToTe[incident.ID]
	}
}

func queryActiveBetweenTimes(query sq.SelectBuilder, start int64, end int64) sq.SelectBuilder {
	return query.Where(
		sq.And{
			sq.Or{
				sq.GtOrEq{"i.EndAt": start},
				sq.Eq{"i.EndAt": 0},
			},
			sq.Lt{"i.CreateAt": end},
		})
}

func queryStartedBetweenTimes(query sq.SelectBuilder, start int64, end int64) sq.SelectBuilder {
	return query.Where(
		sq.And{
			sq.GtOrEq{"i.CreateAt": start},
			sq.Lt{"i.CreateAt": end},
		})
}
