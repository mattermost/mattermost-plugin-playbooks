package sqlstore

import (
	"fmt"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
)

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
			"CreateAt", "EndAt", "DeleteAt", "ActiveStage", "PostID", "PlaybookID").
		From("Incident")

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

	if len(options.TeamID) > 0 {
		builder.
			Where(sq.Eq{"TeamID": options.TeamID})
	}
	if options.Status == incident.Ongoing {
		builder.
			Where(sq.Eq{"IsActive": true})
	} else if options.Status == incident.Ended {
		builder.
			Where(sq.Eq{"IsActive": false})
	}
	if len(options.CommanderID) > 0 {
		builder.
			Where(sq.Eq{"CommanderID": options.CommanderID})
	}

	// TODO: replace % in search term?
	if len(options.SearchTerm) > 0 {
		builder.Where(sq.Like{"Name": fmt.Sprint("%", options.TeamID, "%")})
	}

	// TODO: move to permission-checking in the sql call so we don't have to retrieve every incident
	var incidents []*incident.Incident
	if err := s.store.selectBuilder(s.store.db, &incidents, builder); err != nil {

	}

	return nil, nil
}

// CreateIncident creates a new incident.
func (s *incidentStore) CreateIncident(incdnt *incident.Incident) (*incident.Incident, error) {
	return nil, nil
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
