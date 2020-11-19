package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-management/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-management/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type sqlIncident struct {
	incident.Incident
	ChecklistsJSON json.RawMessage
}

// incidentStore holds the information needed to fulfill the methods in the store interface.
type incidentStore struct {
	pluginAPI         PluginAPIClient
	log               bot.Logger
	store             *SQLStore
	queryBuilder      sq.StatementBuilderType
	incidentSelect    sq.SelectBuilder
	statusPostsSelect sq.SelectBuilder
}

// Ensure playbookStore implements the playbook.Store interface.
var _ incident.Store = (*incidentStore)(nil)

type statusPosts []struct {
	IncidentID string
	PostID     string
}

// NewIncidentStore creates a new store for incident ServiceImpl.
func NewIncidentStore(pluginAPI PluginAPIClient, log bot.Logger, sqlStore *SQLStore) incident.Store {
	// When adding an Incident column #1: add to this select
	incidentSelect := sqlStore.builder.
		Select("ID", "Name", "Description", "IsActive", "CommanderUserID", "TeamID", "ChannelID",
			"CreateAt", "EndAt", "DeleteAt", "ActiveStage", "ActiveStageTitle", "PostID", "PlaybookID",
			"ChecklistsJSON", "ReminderPostID").
		From("IR_Incident AS incident")

	statusPostsSelect := sqlStore.builder.
		Select("IncidentID", "PostID").
		From("IR_StatusPosts")

	return &incidentStore{
		pluginAPI:         pluginAPI,
		log:               log,
		store:             sqlStore,
		queryBuilder:      sqlStore.builder,
		incidentSelect:    incidentSelect,
		statusPostsSelect: statusPostsSelect,
	}
}

// GetIncidents returns filtered incidents and the total count before paging.
func (s *incidentStore) GetIncidents(requesterInfo incident.RequesterInfo, options incident.HeaderFilterOptions) (*incident.GetIncidentsResults, error) {
	if err := incident.ValidateOptions(&options); err != nil {
		return nil, err
	}

	permissionsExpr := s.buildPermissionsExpr(requesterInfo)

	queryForResults := s.incidentSelect.
		Where(permissionsExpr).
		Where(sq.Eq{"TeamID": options.TeamID}).
		Where(sq.Eq{"DeleteAt": 0}).
		Offset(uint64(options.Page * options.PerPage)).
		Limit(uint64(options.PerPage))

	queryForTotal := s.store.builder.
		Select("COUNT(*)").
		From("IR_Incident AS incident").
		Where(permissionsExpr).
		Where(sq.Eq{"TeamID": options.TeamID}).
		Where(sq.Eq{"DeleteAt": 0})

	if options.Status == incident.Ongoing {
		queryForResults = queryForResults.Where(sq.Eq{"IsActive": true})
		queryForTotal = queryForTotal.Where(sq.Eq{"IsActive": true})
	} else if options.Status == incident.Ended {
		queryForResults = queryForResults.Where(sq.Eq{"IsActive": false})
		queryForTotal = queryForTotal.Where(sq.Eq{"IsActive": false})
	}

	if options.CommanderID != "" {
		queryForResults = queryForResults.Where(sq.Eq{"CommanderUserID": options.CommanderID})
		queryForTotal = queryForTotal.Where(sq.Eq{"CommanderUserID": options.CommanderID})
	}

	if options.MemberID != "" {
		membershipClause := s.queryBuilder.
			Select("1").
			Prefix("EXISTS(").
			From("ChannelMembers AS cm").
			Where("cm.ChannelId = incident.ChannelID").
			Where(sq.Eq{"cm.UserId": strings.ToLower(options.MemberID)}).
			Suffix(")")

		queryForResults = queryForResults.Where(membershipClause)
		queryForTotal = queryForTotal.Where(membershipClause)
	}

	// TODO: do we need to sanitize (replace any '%'s in the search term)?
	if options.SearchTerm != "" {
		column := "Name"
		searchString := options.SearchTerm

		// Postgres performs a case-sensitive search, so we need to lowercase
		// both the column contents and the search string
		if s.store.db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			column = "LOWER(Name)"
			searchString = strings.ToLower(options.SearchTerm)
		}

		queryForResults = queryForResults.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
		queryForTotal = queryForTotal.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
	}

	queryForResults = queryForResults.OrderBy(fmt.Sprintf("%s %s", options.Sort, options.Direction))

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
	pageCount := int(math.Ceil(float64(total) / float64(options.PerPage)))
	hasMore := options.Page+1 < pageCount

	incidents := make([]incident.Incident, 0, len(rawIncidents))
	for _, rawIncident := range rawIncidents {
		incident, err2 := s.toIncident(rawIncident)
		if err2 != nil {
			return nil, err2
		}
		incidents = append(incidents, *incident)
	}

	var statusIDs statusPosts
	err = s.store.selectBuilder(tx, &statusIDs, s.statusPostsSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrapf(err, "failed to get statusPosts")
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "could not commit transaction")
	}

	addStatusPostsToIncidents(statusIDs, incidents)

	return &incident.GetIncidentsResults{
		TotalCount: total,
		PageCount:  pageCount,
		HasMore:    hasMore,
		Items:      incidents,
	}, nil
}

// CreateIncident creates a new incident. It assumes that ActiveStage is correct
// and that ActiveStageTitle is already synced.
func (s *incidentStore) CreateIncident(newIncident *incident.Incident) (out *incident.Incident, err error) {
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

	tx, err := s.store.db.Beginx()
	if err != nil {
		return out, errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	// When adding an Incident column #2: add to the SetMap
	_, err = s.store.execBuilder(tx, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":               rawIncident.ID,
			"Name":             rawIncident.Name,
			"Description":      rawIncident.Description,
			"IsActive":         rawIncident.IsActive,
			"CommanderUserID":  rawIncident.CommanderUserID,
			"TeamID":           rawIncident.TeamID,
			"ChannelID":        rawIncident.ChannelID,
			"CreateAt":         rawIncident.CreateAt,
			"EndAt":            rawIncident.EndAt,
			"DeleteAt":         rawIncident.DeleteAt,
			"ActiveStage":      rawIncident.ActiveStage,
			"ActiveStageTitle": rawIncident.ActiveStageTitle,
			"PostID":           rawIncident.PostID,
			"PlaybookID":       rawIncident.PlaybookID,
			"ChecklistsJSON":   rawIncident.ChecklistsJSON,
			"ReminderPostID":   rawIncident.ReminderPostID,
		}))

	if err != nil {
		return nil, errors.Wrapf(err, "failed to store new incident")
	}

	if err = s.replaceStatusPosts(tx, rawIncident.Incident); err != nil {
		return nil, errors.Wrap(err, "failed to replace status posts")
	}

	if err = tx.Commit(); err != nil {
		return out, errors.Wrap(err, "could not commit transaction")
	}

	return incidentCopy, nil
}

// UpdateIncident updates an incident. It assumes that ActiveStage is correct
// and that ActiveStageTitle is already synced.
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

	tx, err := s.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	// When adding an Incident column #3: add to this SetMap (if it is a column that can be updated)
	_, err = s.store.execBuilder(tx, sq.
		Update("IR_Incident").
		SetMap(map[string]interface{}{
			"Name":             rawIncident.Name,
			"Description":      rawIncident.Description,
			"IsActive":         rawIncident.IsActive,
			"CommanderUserID":  rawIncident.CommanderUserID,
			"EndAt":            rawIncident.EndAt,
			"DeleteAt":         rawIncident.DeleteAt,
			"ActiveStage":      rawIncident.ActiveStage,
			"ActiveStageTitle": rawIncident.ActiveStageTitle,
			"ChecklistsJSON":   rawIncident.ChecklistsJSON,
			"ReminderPostID":   rawIncident.ReminderPostID,
		}).
		Where(sq.Eq{"ID": rawIncident.ID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update incident with id '%s'", rawIncident.ID)
	}

	if err = s.replaceStatusPosts(tx, rawIncident.Incident); err != nil {
		return errors.Wrapf(err, "failed to replace status posts for incident with id '%s'", rawIncident.ID)
	}

	if err = tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit transaction")
	}

	return nil
}

// GetIncident gets an incident by ID.
func (s *incidentStore) GetIncident(incidentID string) (out *incident.Incident, err error) {
	if incidentID == "" {
		return nil, errors.New("ID cannot be empty")
	}

	tx, err := s.store.db.Beginx()
	if err != nil {
		return out, errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	var rawIncident sqlIncident
	err = s.store.getBuilder(tx, &rawIncident, s.incidentSelect.Where(sq.Eq{"ID": incidentID}))
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(incident.ErrNotFound, "incident with id '%s' does not exist", incidentID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get incident by id '%s'", incidentID)
	}

	if out, err = s.toIncident(rawIncident); err != nil {
		return out, err
	}

	var statusIDs statusPosts
	err = s.store.selectBuilder(tx, &statusIDs, s.statusPostsSelect.Where(sq.Eq{"IncidentID": incidentID}))
	if err != nil && err != sql.ErrNoRows {
		return out, errors.Wrapf(err, "failed to get statusPosts for incident with id '%s'", incidentID)
	}

	if err = tx.Commit(); err != nil {
		return out, errors.Wrap(err, "could not commit transaction")
	}

	for _, p := range statusIDs {
		out.StatusPostsIDs = append(out.StatusPostsIDs, p.PostID)
	}

	return out, nil
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
func (s *incidentStore) GetCommanders(requesterInfo incident.RequesterInfo, options incident.HeaderFilterOptions) ([]incident.CommanderInfo, error) {
	if err := incident.ValidateOptions(&options); err != nil {
		return nil, err
	}

	permissionsExpr := s.buildPermissionsExpr(requesterInfo)

	// At the moment, the options only includes teamID
	query := s.queryBuilder.
		Select("DISTINCT u.Id AS UserID", "u.Username").
		From("IR_Incident AS incident").
		Join("Users AS u ON incident.CommanderUserID = u.Id").
		Where(sq.Eq{"TeamID": options.TeamID}).
		Where(permissionsExpr)

	var commanders []incident.CommanderInfo
	err := s.store.selectBuilder(s.store.db, &commanders, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query database")
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

func (s *incidentStore) buildPermissionsExpr(info incident.RequesterInfo) sq.Sqlizer {
	if info.UserIDtoIsAdmin[info.UserID] {
		return nil
	}

	// is the requester a channel member, or is the channel public?
	return sq.Expr(`
		  (
			  -- If requester is a channel member
			  EXISTS(SELECT 1
						 FROM ChannelMembers as cm
						 WHERE cm.ChannelId = incident.ChannelID
						   AND cm.UserId = ?)
			  -- Or if channel is public
			  OR EXISTS(SELECT 1
							FROM Channels as c
							WHERE c.Id = incident.ChannelID
							  AND c.Type = 'O')
		  )`, info.UserID)
}

func (s *incidentStore) toIncident(rawIncident sqlIncident) (*incident.Incident, error) {
	i := rawIncident.Incident
	if err := json.Unmarshal(rawIncident.ChecklistsJSON, &i.Checklists); err != nil {
		return nil, errors.Wrapf(err, "failed to unmarshal checklists json for incident id: %s", rawIncident.ID)
	}

	return &i, nil
}

func (s *incidentStore) replaceStatusPosts(q queryExecer, incidentToSave incident.Incident) error {
	// Delete existing posts that are not in the new incidentToSave.StatusPostsIDs list
	delBuilder := sq.Delete("IR_StatusPosts").
		Where(sq.Eq{"IncidentID": incidentToSave.ID}).
		Where(sq.NotEq{"PostID": incidentToSave.StatusPostsIDs})
	if _, err := s.store.execBuilder(q, delBuilder); err != nil {
		return err
	}

	if len(incidentToSave.StatusPostsIDs) == 0 {
		return nil
	}

	insertExpr := `
INSERT INTO IR_StatusPosts(IncidentID, PostID)
    SELECT ?, ?
    WHERE NOT EXISTS (
        SELECT 1 FROM IR_StatusPosts
            WHERE IncidentID = ? AND PostID = ?
    );`
	if s.store.db.DriverName() == model.DATABASE_DRIVER_MYSQL {
		insertExpr = `
INSERT INTO IR_StatusPosts(IncidentID, PostID)
    SELECT ?, ? FROM DUAL
    WHERE NOT EXISTS (
        SELECT 1 FROM IR_StatusPosts
            WHERE IncidentID = ? AND PostID = ?
    );`
	}

	for _, p := range incidentToSave.StatusPostsIDs {
		rawInsert := sq.Expr(insertExpr,
			incidentToSave.ID, p, incidentToSave.ID, p)

		if _, err := s.store.execBuilder(q, rawInsert); err != nil {
			return err
		}
	}

	return nil
}

func toSQLIncident(origIncident incident.Incident) (*sqlIncident, error) {
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

func addStatusPostsToIncidents(statusIDs statusPosts, incidents []incident.Incident) {
	iToSP := make(map[string][]string)
	for _, p := range statusIDs {
		iToSP[p.IncidentID] = append(iToSP[p.IncidentID], p.PostID)
	}
	for i, incdnt := range incidents {
		incidents[i].StatusPostsIDs = iToSP[incdnt.ID]
	}
}
