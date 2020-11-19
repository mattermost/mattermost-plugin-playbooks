package sqlstore

import (
	"encoding/json"
	"fmt"

	sq "github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type Migration struct {
	fromVersion   semver.Version
	toVersion     semver.Version
	migrationFunc func(sqlx.Ext, *SQLStore) error
}

const MySQLCharset = "DEFAULT CHARACTER SET utf8mb4"

// 'IF NOT EXISTS' syntax is not supported in Postgres 9.4, so we need
// this workaround to make the migration idempotent
var createPGIndex = func(indexName, tableName, columns string) string {
	return fmt.Sprintf(`
						DO
						$$
						BEGIN
							IF to_regclass('%s') IS NULL THEN
								CREATE INDEX %s ON %s (%s);
							END IF;
						END
						$$;
					`, indexName, indexName, tableName, columns)
}

var migrations = []Migration{
	{
		fromVersion: semver.MustParse("0.0.0"),
		toVersion:   semver.MustParse("0.1.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if _, err := e.Exec(`
				CREATE TABLE IF NOT EXISTS IR_System (
					SKey VARCHAR(64) PRIMARY KEY,
					SValue VARCHAR(1024) NULL
				);
			`); err != nil {
				return errors.Wrapf(err, "failed creating table IR_System")
			}

			if e.DriverName() == model.DATABASE_DRIVER_MYSQL {

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_Incident (
						ID VARCHAR(26) PRIMARY KEY,
						Name VARCHAR(1024) NOT NULL,
						Description VARCHAR(4096) NOT NULL,
						IsActive BOOLEAN NOT NULL,
						CommanderUserID VARCHAR(26) NOT NULL,
						TeamID VARCHAR(26) NOT NULL,
						ChannelID VARCHAR(26) NOT NULL UNIQUE,
						CreateAt BIGINT NOT NULL,
						EndAt BIGINT NOT NULL DEFAULT 0,
						DeleteAt BIGINT NOT NULL DEFAULT 0,
						ActiveStage BIGINT NOT NULL,
						PostID VARCHAR(26) NOT NULL DEFAULT '',
						PlaybookID VARCHAR(26) NOT NULL DEFAULT '',
						ChecklistsJSON TEXT NOT NULL,
						INDEX IR_Incident_TeamID (TeamID),
						INDEX IR_Incident_TeamID_CommanderUserID (TeamID, CommanderUserID),
						INDEX IR_Incident_ChannelID (ChannelID)
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_Incident")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_Playbook (
						ID VARCHAR(26) PRIMARY KEY,
						Title VARCHAR(1024) NOT NULL,
						Description VARCHAR(4096) NOT NULL,
						TeamID VARCHAR(26) NOT NULL,
						CreatePublicIncident BOOLEAN NOT NULL,
						CreateAt BIGINT NOT NULL,
						DeleteAt BIGINT NOT NULL DEFAULT 0,
						ChecklistsJSON TEXT NOT NULL,
						NumStages BIGINT NOT NULL DEFAULT 0,
						NumSteps BIGINT NOT NULL DEFAULT 0,
						INDEX IR_Playbook_TeamID (TeamID),
						INDEX IR_PlaybookMember_PlaybookID (ID)
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_Playbook")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_PlaybookMember (
						PlaybookID VARCHAR(26) NOT NULL REFERENCES IR_Playbook(ID),
						MemberID VARCHAR(26) NOT NULL,
						INDEX IR_PlaybookMember_PlaybookID (PlaybookID),
						INDEX IR_PlaybookMember_MemberID (MemberID)
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_PlaybookMember")
				}
			} else {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_Incident (
						ID TEXT PRIMARY KEY,
						Name TEXT NOT NULL,
						Description TEXT NOT NULL,
						IsActive BOOLEAN NOT NULL,
						CommanderUserID TEXT NOT NULL,
						TeamID TEXT NOT NULL,
						ChannelID TEXT NOT NULL UNIQUE,
						CreateAt BIGINT NOT NULL,
						EndAt BIGINT NOT NULL DEFAULT 0,
						DeleteAt BIGINT NOT NULL DEFAULT 0,
						ActiveStage BIGINT NOT NULL,
						PostID TEXT NOT NULL DEFAULT '',
						PlaybookID TEXT NOT NULL DEFAULT '',
						ChecklistsJSON JSON NOT NULL
					);
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_Incident")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_Playbook (
						ID TEXT PRIMARY KEY,
						Title TEXT NOT NULL,
						Description TEXT NOT NULL,
						TeamID TEXT NOT NULL,
						CreatePublicIncident BOOLEAN NOT NULL,
						CreateAt BIGINT NOT NULL,
						DeleteAt BIGINT NOT NULL DEFAULT 0,
						ChecklistsJSON JSON NOT NULL,
						NumStages BIGINT NOT NULL DEFAULT 0,
						NumSteps BIGINT NOT NULL DEFAULT 0
					);
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_Playbook")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_PlaybookMember (
						PlaybookID TEXT NOT NULL REFERENCES IR_Playbook(ID),
						MemberID TEXT NOT NULL,
						UNIQUE (PlaybookID, MemberID)
					);
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_PlaybookMember")
				}

				if _, err := e.Exec(createPGIndex("IR_Incident_TeamID", "IR_Incident", "TeamID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Incident_TeamID")
				}

				if _, err := e.Exec(createPGIndex("IR_Incident_TeamID_CommanderUserID", "IR_Incident", "TeamID, CommanderUserID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Incident_TeamID_CommanderUserID")
				}

				if _, err := e.Exec(createPGIndex("IR_Incident_ChannelID", "IR_Incident", "ChannelID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Incident_ChannelID")
				}

				if _, err := e.Exec(createPGIndex("IR_Playbook_TeamID", "IR_Playbook", "TeamID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Playbook_TeamID")
				}

				if _, err := e.Exec(createPGIndex("IR_PlaybookMember_PlaybookID", "IR_PlaybookMember", "PlaybookID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_PlaybookMember_PlaybookID")
				}

				if _, err := e.Exec(createPGIndex("IR_PlaybookMember_MemberID", "IR_PlaybookMember", "MemberID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_PlaybookMember_MemberID ")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.1.0"),
		toVersion:   semver.MustParse("0.2.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			// prior to v1.0.0 of the plugin, this migration was used to trigger the data migration from the kvstore
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.2.0"),
		toVersion:   semver.MustParse("0.3.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DATABASE_DRIVER_MYSQL {
				if _, err := e.Exec("ALTER TABLE IR_Incident ADD ActiveStageTitle VARCHAR(1024) DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ActiveStageTitle to table IR_Incident")
				}

			} else {
				if _, err := e.Exec("ALTER TABLE IR_Incident ADD ActiveStageTitle TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ActiveStageTitle to table IR_Incident")
				}
			}

			getIncidentsQuery := sqlStore.builder.
				Select("ID", "ActiveStage", "ChecklistsJSON").
				From("IR_Incident")

			var incidents []struct {
				ID             string
				ActiveStage    int
				ChecklistsJSON json.RawMessage
			}
			if err := sqlStore.selectBuilder(e, &incidents, getIncidentsQuery); err != nil {
				return errors.Wrapf(err, "failed getting incidents to update their ActiveStageTitle")
			}

			for _, theIncident := range incidents {
				var checklists []playbook.Checklist
				if err := json.Unmarshal(theIncident.ChecklistsJSON, &checklists); err != nil {
					return errors.Wrapf(err, "failed to unmarshal checklists json for incident id: '%s'", theIncident.ID)
				}

				numChecklists := len(checklists)
				if numChecklists == 0 {
					continue
				}

				if theIncident.ActiveStage < 0 || theIncident.ActiveStage >= numChecklists {
					sqlStore.log.Warnf("index %d out of bounds, incident '%s' has %d stages: setting ActiveStageTitle to the empty string", theIncident.ActiveStage, theIncident.ID, numChecklists)
					continue
				}

				incidentUpdate := sqlStore.builder.
					Update("IR_Incident").
					Set("ActiveStageTitle", checklists[theIncident.ActiveStage].Title).
					Where(sq.Eq{"ID": theIncident.ID})

				if _, err := sqlStore.execBuilder(e, incidentUpdate); err != nil {
					return errors.Errorf("failed updating the ActiveStageTitle field of incident '%s'", theIncident.ID)
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.3.0"),
		toVersion:   semver.MustParse("0.4.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {

			if e.DriverName() == model.DATABASE_DRIVER_MYSQL {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_StatusPosts (
						IncidentID VARCHAR(26) NOT NULL REFERENCES IR_Incident(ID),
						PostID VARCHAR(26) NOT NULL,
						INDEX IR_StatusPosts_IncidentID (IncidentID),
						INDEX IR_StatusPosts_PostID (PostID)
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_StatusPosts")
				}

				if _, err := e.Exec("ALTER TABLE IR_Incident ADD ReminderPostID VARCHAR(26)"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderPostID to table IR_Incident")
				}

				if _, err := e.Exec("ALTER TABLE IR_Incident ADD BroadcastChannelID VARCHAR(26) DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column BroadcastChannelID to table IR_Incident")
				}

				if _, err := e.Exec("ALTER TABLE IR_Playbook ADD BroadcastChannelID VARCHAR(26) DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column BroadcastChannelID to table IR_Playbook")
				}

			} else {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_StatusPosts (
						IncidentID TEXT NOT NULL REFERENCES IR_Incident(ID),
						PostID TEXT NOT NULL,
						UNIQUE (IncidentID, PostID)
					);
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_StatusPosts")
				}

				if _, err := e.Exec(createPGIndex("IR_StatusPosts_IncidentID", "IR_StatusPosts", "IncidentID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_StatusPosts_IncidentID")
				}

				if _, err := e.Exec(createPGIndex("IR_StatusPosts_PostID", "IR_StatusPosts", "PostID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_StatusPosts_PostID ")
				}

				if _, err := e.Exec("ALTER TABLE IR_Incident ADD ReminderPostID TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderPostID to table IR_Incident")
				}

				if _, err := e.Exec("ALTER TABLE IR_Incident ADD BroadcastChannelID TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column BroadcastChannelID to table IR_Incident")
				}

				if _, err := e.Exec("ALTER TABLE IR_Playbook ADD BroadcastChannelID TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column BroadcastChannelID to table IR_Playbook")
				}
			}

			incidentUpdate := sqlStore.builder.
				Update("IR_Incident").
				Set("ReminderPostID", "").
				Where(sq.Eq{"ReminderPostID": nil})
			if _, err := sqlStore.execBuilder(e, incidentUpdate); err != nil {
				return errors.Errorf("failed updating ReminderPostID field")
			}

			return nil
		},
	},
}
