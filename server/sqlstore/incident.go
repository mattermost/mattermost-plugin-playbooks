package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"unicode"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

type sqlIncident struct {
	incident.Incident
	ChecklistsJSON json.RawMessage
}

// incidentStore holds the information needed to fulfill the methods in the store interface.
type incidentStore struct {
	pluginAPI      PluginAPIClient
	log            bot.Logger
	store          *SQLStore
	queryBuilder   sq.StatementBuilderType
	incidentSelect sq.SelectBuilder
}

// Ensure playbookStore implements the playbook.Store interface.
var _ incident.Store = (*incidentStore)(nil)

// NewIncidentStore creates a new store for incident ServiceImpl.
func NewIncidentStore(pluginAPI PluginAPIClient, log bot.Logger, sqlStore *SQLStore) incident.Store {
	incidentSelect := sqlStore.builder.
		Select("ID", "Name", "Description", "IsActive", "CommanderUserID", "TeamID", "ChannelID",
			"CreateAt", "EndAt", "DeleteAt", "ActiveStage", "PostID", "PlaybookID").
		From("IR_Incident AS inc")

	return &incidentStore{
		pluginAPI:      pluginAPI,
		log:            log,
		store:          sqlStore,
		queryBuilder:   sqlStore.builder,
		incidentSelect: incidentSelect,
	}
}

// GetIncidents returns filtered incidents and the total count before paging.
func (s *incidentStore) GetIncidents(requesterID string, opts incident.HeaderFilterOptions) (*incident.GetIncidentsResults, error) {
	if err := incident.ValidateOptions(&opts); err != nil {
		return nil, err
	}

	isAdminOrMemberOrPublicChannel := buildPermissionsExpr(requesterID, opts.TeamID)

	queryForResults := s.incidentSelect.
		Where(isAdminOrMemberOrPublicChannel).
		Where(sq.Eq{"TeamID": opts.TeamID}).
		Where(sq.Eq{"DeleteAt": 0}).
		Offset(uint64(opts.Page * opts.PerPage)).
		Limit(uint64(opts.PerPage))

	queryForTotal := s.store.builder.
		Select("COUNT(*)").
		From("IR_Incident AS inc").
		Where(isAdminOrMemberOrPublicChannel).
		Where(sq.Eq{"TeamID": opts.TeamID}).
		Where(sq.Eq{"DeleteAt": 0})

	if opts.Status == incident.Ongoing {
		queryForResults = queryForResults.Where(sq.Eq{"IsActive": true})
		queryForTotal = queryForTotal.Where(sq.Eq{"IsActive": true})
	} else if opts.Status == incident.Ended {
		queryForResults = queryForResults.Where(sq.Eq{"IsActive": false})
		queryForTotal = queryForTotal.Where(sq.Eq{"IsActive": false})
	}

	if opts.CommanderID != "" {
		queryForResults = queryForResults.Where(sq.Eq{"CommanderUserID": opts.CommanderID})
		queryForTotal = queryForTotal.Where(sq.Eq{"CommanderUserID": opts.CommanderID})
	}

	// TODO: do we need to sanitize (replace any '%'s in the search term)?
	if opts.SearchTerm != "" {
		column := "Name"
		searchString := opts.SearchTerm

		// Postgres performs a case-sensitive search, so we need to lowercase
		// both the column contents and the search string
		if s.store.db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			column = "LOWER(UNACCENT(Name))"
			searchString = normalize(opts.SearchTerm)
		}

		queryForResults = queryForResults.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
		queryForTotal = queryForTotal.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
	}

	queryForResults = queryForResults.OrderBy(fmt.Sprintf("%s %s", opts.Sort, opts.Order))

	var incidents []incident.Incident
	if err := s.store.selectBuilder(s.store.db, &incidents, queryForResults); err != nil {
		return nil, errors.Wrap(err, "failed to query for incidents")
	}

	for i := range incidents {
		incidents[i].Checklists = []playbook.Checklist{}
	}
	if incidents == nil {
		incidents = []incident.Incident{}
	}

	var total int
	if err := s.store.getBuilder(s.store.db, &total, queryForTotal); err != nil {
		return nil, errors.Wrap(err, "failed to get total count")
	}
	pageCount := int(math.Ceil(float64(total) / float64(opts.PerPage)))
	hasMore := opts.Page+1 < pageCount

	return &incident.GetIncidentsResults{
		TotalCount: total,
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
	incidentCopy := newIncident.Clone()
	incidentCopy.ID = model.NewId()

	rawIncident, err := toSQLIncident(*incidentCopy)
	if err != nil {
		return nil, err
	}

	_, err = s.store.execBuilder(s.store.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":              rawIncident.ID,
			"Name":            rawIncident.Name,
			"Description":     rawIncident.Description,
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
			"ChecklistsJSON":  rawIncident.ChecklistsJSON,
		}))

	if err != nil {
		return nil, errors.Wrapf(err, "failed to store new incident")
	}

	return incidentCopy, nil
}

// UpdateIncident updates an incident.
func (s *incidentStore) UpdateIncident(newIncident *incident.Incident) error {
	if newIncident == nil {
		return errors.New("incident is nil")
	}
	if newIncident.ID == "" {
		return errors.New("ID should not be empty")
	}

	rawIncident, err := toSQLIncident(*newIncident)
	if err != nil {
		return err
	}

	_, err = s.store.execBuilder(s.store.db, sq.
		Update("IR_Incident").
		SetMap(map[string]interface{}{
			"Name":            rawIncident.Name,
			"Description":     rawIncident.Description,
			"IsActive":        rawIncident.IsActive,
			"CommanderUserID": rawIncident.CommanderUserID,
			"EndAt":           rawIncident.EndAt,
			"DeleteAt":        rawIncident.DeleteAt,
			"ActiveStage":     rawIncident.ActiveStage,
			"ChecklistsJSON":  rawIncident.ChecklistsJSON,
		}).
		Where(sq.Eq{"ID": rawIncident.ID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update incident with id '%s'", rawIncident.ID)
	}

	return nil
}

// GetIncident gets an incident by ID.
func (s *incidentStore) GetIncident(incidentID string) (*incident.Incident, error) {
	if incidentID == "" {
		return nil, errors.New("ID cannot be empty")
	}

	withChecklistsSelect := s.incidentSelect.
		Columns("ChecklistsJSON").
		From("IR_Incident")

	var rawIncident sqlIncident
	err := s.store.getBuilder(s.store.db, &rawIncident, withChecklistsSelect.Where(sq.Eq{"ID": incidentID}))
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(incident.ErrNotFound, "incident with id '%s' does not exist", incidentID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get incident by id '%s'", incidentID)
	}

	return toIncident(rawIncident)
}

// GetIncidentIDForChannel gets the incidentID associated with the given channelID.
func (s *incidentStore) GetIncidentIDForChannel(channelID string) (string, error) {
	query := s.queryBuilder.
		Select("ID").
		From("IR_Incident").
		Where(sq.Eq{"ChannelID": channelID})

	var id string
	err := s.store.getBuilder(s.store.db, &id, query)
	if err == sql.ErrNoRows {
		return "", errors.Wrapf(incident.ErrNotFound, "channel with id (%s) does not have an incident", channelID)
	} else if err != nil {
		return "", errors.Wrapf(err, "failed to get incident by channelID '%s'", channelID)
	}

	return id, nil
}

// GetAllIncidentMembersCount returns the count of all members of an incident since the
// beginning of the incident, excluding bots.
func (s *incidentStore) GetAllIncidentMembersCount(channelID string) (int64, error) {
	query := s.queryBuilder.
		Select("COUNT(DISTINCT UserId)").
		From("ChannelMemberHistory AS u").
		Where(sq.Eq{"ChannelId": channelID}).
		Where(sq.Expr("u.UserId NOT IN (SELECT UserId FROM Bots)"))

	var numMembers int64
	err := s.store.getBuilder(s.store.db, &numMembers, query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to query database")
	}

	return numMembers, nil
}

// GetCommanders returns the commanders of the incidents selected by options
func (s *incidentStore) GetCommanders(requesterID string, opts incident.HeaderFilterOptions) ([]incident.CommanderInfo, error) {
	if err := incident.ValidateOptions(&opts); err != nil {
		return nil, err
	}

	isAdminOrMemberOrPublicChannel := buildPermissionsExpr(requesterID, opts.TeamID)

	// At the moment, the opts only includes teamID
	query := s.queryBuilder.
		Select("DISTINCT CommanderUserID AS UserID", "Username").
		From("IR_Incident AS inc").
		Join("Users AS u ON inc.CommanderUserID = u.Id").
		Where(sq.Eq{"TeamID": opts.TeamID}).
		Where(isAdminOrMemberOrPublicChannel)

	var commanders []incident.CommanderInfo
	err := s.store.selectBuilder(s.store.db, &commanders, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query database")
	}

	if commanders == nil {
		commanders = []incident.CommanderInfo{}
	}

	return commanders, nil
}

// NukeDB removes all incident related data.
func (s *incidentStore) NukeDB() (err error) {
	tx, err := s.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	if _, err := tx.Exec("DELETE FROM IR_Incident"); err != nil {
		return errors.Wrap(err, "could not delete IR_Incident")
	}

	if _, err := tx.Exec("DELETE FROM IR_Playbook"); err != nil {
		return errors.Wrap(err, "could not delete IR_Playbook")
	}
	if _, err := tx.Exec("DELETE FROM IR_PlaybookMember"); err != nil {
		return errors.Wrap(err, "could not delete IR_Playbook")
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "could not delete all rows")
	}

	return nil
}

func toSQLIncident(origIncident incident.Incident) (*sqlIncident, error) {
	for _, checklist := range origIncident.Checklists {
		if len(checklist.Items) == 0 {
			return nil, errors.New("checklists with no items are not allowed")
		}
	}

	newChecklists := populateChecklistIDs(origIncident.Checklists)
	checklistsJSON, err := checklistsToJSON(newChecklists)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal checklist json for incident id: '%s'", origIncident.ID)
	}

	return &sqlIncident{
		Incident:       origIncident,
		ChecklistsJSON: checklistsJSON,
	}, nil
}

// populateChecklistIDs returns a cloned slice with ids entered for checklists and checklist items.
func populateChecklistIDs(checklists []playbook.Checklist) []playbook.Checklist {
	if len(checklists) == 0 {
		return nil
	}

	newChecklists := make([]playbook.Checklist, len(checklists))
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
func checklistsToJSON(checklists []playbook.Checklist) (json.RawMessage, error) {
	checklistsJSON, err := json.Marshal(checklists)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal checklist json")
	}

	return checklistsJSON, nil
}

func toIncident(rawIncident sqlIncident) (*incident.Incident, error) {
	i := rawIncident.Incident
	if err := json.Unmarshal(rawIncident.ChecklistsJSON, &i.Checklists); err != nil {
		return nil, errors.Wrapf(err, "failed to unmarshal checklists json for incident id: '%s'", rawIncident.ID)
	}
	return &i, nil
}

// normalize removes unicode marks and lowercases text
func normalize(s string) string {
	// create a transformer, from NFC to NFD, removes non-spacing unicode marks, then back to NFC
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	normed, _, _ := transform.String(t, strings.ToLower(s))
	return normed
}

func buildPermissionsExpr(requesterID, teamID string) sq.Sqlizer {
	isAdminOrMemberOrPublicChannelSQLText := `
		(
              EXISTS(SELECT 1
                         FROM Users AS u
                         WHERE u.Id = ?
                           AND u.Roles LIKE '%system_admin%')
              OR EXISTS(SELECT 1
                            FROM ChannelMembers as cm
                            WHERE cm.ChannelId = inc.ChannelID
                              AND cm.UserId = ?)
              OR (
                      EXISTS(SELECT 1
                                 FROM Channels as c
                                 WHERE c.Id = inc.ChannelID
                                   AND c.Type = 'O')
                      AND EXISTS(SELECT 1
                                     FROM TeamMembers AS t
                                     WHERE t.TeamId = ?
                                       AND t.UserId = ?)
                  )
        )`

	return sq.Expr(isAdminOrMemberOrPublicChannelSQLText,
		requesterID, requesterID, teamID, requesterID)
}
