package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type sqlIncident struct {
	incident.Incident
	ChecklistJSON []byte // TODO: Alejandro, not sure if this is good, or if we should use string
}

// incidentStore holds the information needed to fulfill the methods in the store interface.
type incidentStore struct {
	pluginAPI      PluginAPIClient
	log            bot.Logger
	store          *SQLStore
	queryBuilder   sq.StatementBuilderType
	incidentSelect sq.SelectBuilder
}

// NewIncidentStore creates a new store for incident ServiceImpl.
func NewIncidentStore(pluginAPI PluginAPIClient, log bot.Logger, sqlStore *SQLStore) incident.Store {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if pluginAPI.Store.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	incidentSelect := builder.
		Select("ID", "Name", "IsActive", "CommanderUserID", "TeamID", "ChannelID",
			"CreateAt", "EndAt", "DeleteAt", "ActiveStage", "PostID", "PlaybookID", "ChecklistsJSON").
		From("IR_Incident")

	newStore := &incidentStore{
		pluginAPI:      pluginAPI,
		log:            log,
		store:          sqlStore,
		queryBuilder:   builder,
		incidentSelect: incidentSelect,
	}
	return newStore
}

// GetIncidents returns filtered incidents and the total count before paging.
func (s *incidentStore) GetIncidents(options incident.HeaderFilterOptions) (*incident.GetIncidentsResults, error) {
	builder := s.incidentSelect

	if options.TeamID != "" {
		builder = builder.
			Where(sq.Eq{"TeamID": options.TeamID})
	}
	if options.Status == incident.Ongoing {
		builder = builder.
			Where(sq.Eq{"IsActive": true})
	} else if options.Status == incident.Ended {
		builder = builder.
			Where(sq.Eq{"IsActive": false})
	}
	if options.CommanderID != "" {
		builder = builder.
			Where(sq.Eq{"CommanderID": options.CommanderID})
	}

	// TODO: do we need to sanitize (replace any '%'s in the search term)?
	if options.SearchTerm != "" {
		builder = builder.Where(sq.Like{"Name": fmt.Sprint("%", options.TeamID, "%")})
	}

	if options.Sort != "" {
		builder = builder.OrderBy(fmt.Sprintf("%s %s", options.Sort, options.Order))
	}

	var rawIncidents []sqlIncident
	if err := s.store.selectBuilder(&rawIncidents, builder); err != nil {
		return nil, errors.Wrap(err, "failed to query for incidents")
	}

	var incidents []incident.Incident
	for _, j := range rawIncidents {
		// TODO: move to permission-checking in the sql call (MM-28008)
		if options.HasPermissionsTo == nil || options.HasPermissionsTo(j.ChannelID) {
			k, err := toIncident(j)
			if err != nil {
				return nil, err
			}
			incidents = append(incidents, *k)
		}
	}

	totalCount := len(incidents)
	incidents = pageIncidents(incidents, options.Page, options.PerPage)
	pageCount := int(math.Ceil(float64(totalCount) / float64(options.PerPage)))
	hasMore := options.Page+1 < pageCount

	return &incident.GetIncidentsResults{
		TotalCount: totalCount,
		PageCount:  pageCount,
		HasMore:    hasMore,
		Items:      incidents,
	}, nil
}

// CreateIncident creates a new incident.
func (s *incidentStore) CreateIncident(newIncident *incident.Incident) (*incident.Incident, error) {
	if newIncident == nil {
		return nil, errors.New("incident is nil")
	}
	if newIncident.ID != "" {
		return nil, errors.New("ID should not be set")
	}
	newIncident.ID = model.NewId()

	rawIncident, err := toSQLIncident(newIncident)
	if err != nil {
		return nil, err
	}

	err = s.store.execBuilder(sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":              rawIncident.ID,
			"Name":            rawIncident.Name,
			"IsActive":        rawIncident.IsActive,
			"CommanderUserID": rawIncident.CommanderUserID,
			"TeamID":          rawIncident.TeamID,
			"ChannelID":       rawIncident.ChannelID,
			"CreateAt":        rawIncident.CreateAt,
			"EndAt":           rawIncident.EndAt,
			"DeleteAt":        rawIncident.DeleteAt,
			"ActiveStage":     rawIncident.ActiveStage,
			"PostID":          rawIncident.PostID,
			"PlaybookID":      rawIncident.PlaybookID,
			"ChecklistsJSON":  rawIncident.ChecklistJSON,
		}))

	if err != nil {
		return nil, errors.Wrapf(err, "failed to store new incident")
	}

	return newIncident, nil
}

// UpdateIncident updates an incident.
func (s *incidentStore) UpdateIncident(newIncident *incident.Incident) error {
	if newIncident == nil {
		return errors.New("incident is nil")
	}
	if newIncident.ID != "" {
		return errors.New("ID should not be set")
	}

	rawIncident, err := toSQLIncident(newIncident)
	if err != nil {
		return err
	}
	err = s.store.execBuilder(sq.
		Update("IR_Incident").
		SetMap(map[string]interface{}{
			"Name":            rawIncident.Name,
			"IsActive":        rawIncident.IsActive,
			"CommanderUserID": rawIncident.CommanderUserID,
			"EndAt":           rawIncident.EndAt,
			"DeleteAt":        rawIncident.DeleteAt,
			"ActiveStage":     rawIncident.ActiveStage,
			"ChecklistsJSON":  rawIncident.ChecklistJSON,
		}).
		Where(sq.Eq{"ID": rawIncident.ID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update incident with id '%s'", rawIncident.ID)
	}

	return nil
}

// GetIncident gets an incident by ID.
func (s *incidentStore) GetIncident(incidentID string) (*incident.Incident, error) {
	var rawIncident sqlIncident
	err := s.store.getBuilder(&rawIncident, s.incidentSelect.Where(sq.Eq{"ID": incidentID}))
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get incident by id '%s'", incidentID)
	}

	return toIncident(rawIncident)
}

// GetIncidentByChannel gets an incident associated with the given channel id.
func (s *incidentStore) GetIncidentIDForChannel(channelID string) (string, error) {
	query := s.queryBuilder.
		Select("ID").
		From("IR_Incident").
		Where(sq.Eq{"ChannelID": channelID})

	var id string
	err := s.store.getBuilder(&id, query)
	if err == sql.ErrNoRows {
		return "", errors.Wrapf(incident.ErrNotFound, "channel with id (%s) does not have an incident", channelID)
	} else if err != nil {
		return "", errors.Wrapf(err, "failed to get incident by channelID '%s'", channelID)
	}

	return id, nil
}

// GetAllIncidentMembersCount returns the count of all members of an incident since the
// beginning of the incident, excluding bots.
func (s *incidentStore) GetAllIncidentMembersCount(incidentID string) (int64, error) {
	query := s.queryBuilder.
		Select("COUNT(DISTINCT UserId)").
		From("ChannelMemberHistory AS u").
		Where(sq.Eq{"ChannelId": incidentID}).
		Where(sq.Expr("u.UserId NOT IN (SELECT UserId FROM Bots)"))

	var numMembers int64
	err := s.store.getBuilder(&numMembers, query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to query database")
	}

	return numMembers, nil
}

// NukeDB removes all incident related data.
func (s *incidentStore) NukeDB() (err error) {
	tx, err := s.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not remove tables")
	}

	defer func() {
		cerr := tx.Rollback()
		if err == nil {
			err = cerr
		}
	}()

	if _, err := tx.Exec("DROP TABLE IR_Incident"); err != nil {
		return errors.Wrap(err, "could not drop IR_Incident")
	}

	if _, err := tx.Exec("DROP TABLE IR_Playbook"); err != nil {
		return errors.Wrap(err, "could not drop IR_Playbook")
	}
	if _, err := tx.Exec("DROP TABLE IR_PlaybookMember"); err != nil {
		return errors.Wrap(err, "could not drop IR_Playbook")
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "could not remove tables")
	}

	return nil
}

func pageIncidents(incidents []incident.Incident, page, perPage int) []incident.Incident {
	// Note: ignoring overflow for now
	start := min(page*perPage, len(incidents))
	end := min(start+perPage, len(incidents))
	return incidents[start:end]
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func toSQLIncident(origIncident *incident.Incident) (*sqlIncident, error) {
	checklistJSON, err := json.Marshal(origIncident.Checklists)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal checklist json for incident id: '%s'", origIncident.ID)
	}
	return &sqlIncident{
		Incident:      *origIncident,
		ChecklistJSON: checklistJSON,
	}, nil
}

func toIncident(rawIncident sqlIncident) (*incident.Incident, error) {
	i := rawIncident.Incident
	// TODO: Alejandro, this should work, but I wouldn't be surprised if I'm missing something.
	if err := json.Unmarshal(rawIncident.ChecklistJSON, &i.Checklists); err != nil {
		return nil, fmt.Errorf("failed to unmarshal checklist json for incident id: '%s'", rawIncident.ID)
	}
	return &i, nil
}
