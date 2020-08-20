package sqlstore

import (
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
		builder = builder.OrderBy(options.Sort + " " + options.Order)
	}

	var rawIncidents []sqlIncident
	if err := s.store.selectBuilder(s.store.db, &rawIncidents, builder); err != nil {
		return nil, errors.Wrap(err, "failed to query for incidents")
	}

	var incidents []incident.Incident
	for _, j := range rawIncidents {
		// TODO: move to permission-checking in the sql call (MM-28008)
		if options.HasPermissionsTo == nil || options.HasPermissionsTo(j.ChannelID) {
			k, err := toIncident(&j)
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

	_, err = s.store.execBuilder(s.store.db, sq.
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
func (s *incidentStore) UpdateIncident(incdnt *incident.Incident) error {
	return nil
}

// GetIncident gets an incident by ID.
func (s *incidentStore) GetIncident(incidentID string) (*incident.Incident, error) {
	return nil, nil
}

// GetIncidentByChannel gets an incident associated with the given channel id.
func (s *incidentStore) GetIncidentIDForChannel(channelID string) (string, error) {
	return "", nil
}

// GetAllIncidentMembersCount returns the count of all members of an incident since the
// beginning of the incident, excluding bots.
func (s *incidentStore) GetAllIncidentMembersCount(incidentID string) (int64, error) {
	return 0, nil
}

// NukeDB removes all incident related data.
func (s *incidentStore) NukeDB() error {
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

func toIncident(rawIncident *sqlIncident) (*incident.Incident, error) {
	i := rawIncident.Incident
	// TODO: Alejandro, this should work, but I wouldn't be surprised if I'm missing something.
	if err := json.Unmarshal(rawIncident.ChecklistJSON, &i.Checklists); err != nil {
		return nil, fmt.Errorf("failed to unmarshal checklist json for incident id: '%s'", rawIncident.ID)
	}
	return &i, nil
}
