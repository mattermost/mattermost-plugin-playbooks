package sqlstore

import (
	"encoding/json"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	"github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

type Migration struct {
	fromVersion   semver.Version
	toVersion     semver.Version
	migrationFunc func(sqlx.Ext, *SQLStore) error
}

const MySQLCharset = "DEFAULT CHARACTER SET utf8mb4"

var migrations = []Migration{
	{
		fromVersion: semver.MustParse("0.0.0"),
		toVersion:   semver.MustParse("0.1.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_System (
						SKey VARCHAR(64) PRIMARY KEY,
						SValue VARCHAR(1024) NULL
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_System")
				}

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
					CREATE TABLE IF NOT EXISTS IR_System (
						SKey VARCHAR(64) PRIMARY KEY,
						SValue VARCHAR(1024) NULL
					);
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_System")
				}

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
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "ActiveStageTitle", "VARCHAR(1024) DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ActiveStageTitle to table IR_Incident")
				}

			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "ActiveStageTitle", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ActiveStageTitle to table IR_Incident")
				}
			}

			getPlaybookRunsQuery := sqlStore.builder.
				Select("ID", "ActiveStage", "ChecklistsJSON").
				From("IR_Incident")

			var playbookRuns []struct {
				ID             string
				ActiveStage    int
				ChecklistsJSON json.RawMessage
			}
			if err := sqlStore.selectBuilder(e, &playbookRuns, getPlaybookRunsQuery); err != nil {
				return errors.Wrapf(err, "failed getting playbook runs to update their ActiveStageTitle")
			}

			for _, playbookRun := range playbookRuns {
				var checklists []app.Checklist
				if err := json.Unmarshal(playbookRun.ChecklistsJSON, &checklists); err != nil {
					return errors.Wrapf(err, "failed to unmarshal checklists json for playbook run id: '%s'", playbookRun.ID)
				}

				numChecklists := len(checklists)
				if numChecklists == 0 {
					continue
				}

				if playbookRun.ActiveStage < 0 || playbookRun.ActiveStage >= numChecklists {
					sqlStore.log.Warnf("index %d out of bounds, playbook ru n'%s' has %d stages: setting ActiveStageTitle to the empty string", playbookRun.ActiveStage, playbookRun.ID, numChecklists)
					continue
				}

				playbookRunUpdate := sqlStore.builder.
					Update("IR_Incident").
					Set("ActiveStageTitle", checklists[playbookRun.ActiveStage].Title).
					Where(sq.Eq{"ID": playbookRun.ID})

				if _, err := sqlStore.execBuilder(e, playbookRunUpdate); err != nil {
					return errors.Errorf("failed updating the ActiveStageTitle field of playbook run '%s'", playbookRun.ID)
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.3.0"),
		toVersion:   semver.MustParse("0.4.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {

			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_StatusPosts (
						IncidentID VARCHAR(26) NOT NULL REFERENCES IR_Incident(ID),
						PostID VARCHAR(26) NOT NULL,
						CONSTRAINT posts_unique UNIQUE (IncidentID, PostID),
						INDEX IR_StatusPosts_IncidentID (IncidentID),
						INDEX IR_StatusPosts_PostID (PostID)
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_StatusPosts")
				}

				if err := addColumnToMySQLTable(e, "IR_Incident", "ReminderPostID", "VARCHAR(26)"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderPostID to table IR_Incident")
				}

				if err := addColumnToMySQLTable(e, "IR_Incident", "BroadcastChannelID", "VARCHAR(26) DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column BroadcastChannelID to table IR_Incident")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "BroadcastChannelID", "VARCHAR(26) DEFAULT ''"); err != nil {
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

				if err := addColumnToPGTable(e, "IR_Incident", "ReminderPostID", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderPostID to table IR_Incident")
				}

				if err := addColumnToPGTable(e, "IR_Incident", "BroadcastChannelID", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column BroadcastChannelID to table IR_Incident")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "BroadcastChannelID", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column BroadcastChannelID to table IR_Playbook")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.4.0"),
		toVersion:   semver.MustParse("0.5.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "PreviousReminder", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column PreviousReminder to table IR_Incident")
				}
				if err := addColumnToMySQLTable(e, "IR_Playbook", "ReminderMessageTemplate", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderMessageTemplate to table IR_Playbook")
				}
				if _, err := e.Exec("UPDATE IR_Playbook SET ReminderMessageTemplate = '' WHERE ReminderMessageTemplate IS NULL"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderMessageTemplate to table IR_Playbook")
				}
				if err := addColumnToMySQLTable(e, "IR_Incident", "ReminderMessageTemplate", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderMessageTemplate to table IR_Playbook")
				}
				if _, err := e.Exec("UPDATE IR_Incident SET ReminderMessageTemplate = '' WHERE ReminderMessageTemplate IS NULL"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderMessageTemplate to table IR_Incident")
				}
				if err := addColumnToMySQLTable(e, "IR_Playbook", "ReminderTimerDefaultSeconds", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderTimerDefaultSeconds to table IR_Playbook")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "PreviousReminder", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column PreviousReminder to table IR_Incident")
				}
				if err := addColumnToPGTable(e, "IR_Playbook", "ReminderMessageTemplate", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderMessageTemplate to table IR_Playbook")
				}
				if err := addColumnToPGTable(e, "IR_Incident", "ReminderMessageTemplate", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderMessageTemplate to table IR_Playbook")
				}
				if err := addColumnToPGTable(e, "IR_Playbook", "ReminderTimerDefaultSeconds", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderTimerDefaultSeconds to table IR_Playbook")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.5.0"),
		toVersion:   semver.MustParse("0.6.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "CurrentStatus", "VARCHAR(1024) NOT NULL DEFAULT 'Active'"); err != nil {
					return errors.Wrapf(err, "failed adding column CurrentStatus to table IR_Incident")
				}
				if err := addColumnToMySQLTable(e, "IR_StatusPosts", "Status", "VARCHAR(1024) NOT NULL DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column Status to table IR_StatusPosts")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "CurrentStatus", "TEXT NOT NULL DEFAULT 'Active'"); err != nil {
					return errors.Wrapf(err, "failed adding column CurrentStatus to table IR_Incident")
				}
				if err := addColumnToPGTable(e, "IR_StatusPosts", "Status", "TEXT NOT NULL DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column Status to table IR_StatusPosts")
				}
			}
			if _, err := e.Exec("UPDATE IR_Incident SET CurrentStatus = 'Resolved' WHERE EndAt != 0"); err != nil {
				return errors.Wrapf(err, "failed adding column ReminderMessageTemplate to table IR_Incident")
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.6.0"),
		toVersion:   semver.MustParse("0.7.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_TimelineEvent
					(
						ID            VARCHAR(26)   NOT NULL,
						IncidentID    VARCHAR(26)   NOT NULL REFERENCES IR_Incident(ID),
						CreateAt      BIGINT        NOT NULL,
						DeleteAt      BIGINT        NOT NULL DEFAULT 0,
						EventAt       BIGINT        NOT NULL,
						EventType     VARCHAR(32)   NOT NULL DEFAULT '',
						Summary       VARCHAR(256)  NOT NULL DEFAULT '',
						Details       VARCHAR(4096) NOT NULL DEFAULT '',
						PostID        VARCHAR(26)   NOT NULL DEFAULT '',
						SubjectUserID VARCHAR(26)   NOT NULL DEFAULT '',
						CreatorUserID VARCHAR(26)   NOT NULL DEFAULT '',
						INDEX IR_TimelineEvent_ID (ID),
						INDEX IR_TimelineEvent_IncidentID (IncidentID)
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_TimelineEvent")
				}

			} else {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_TimelineEvent
					(
						ID            TEXT   NOT NULL,
						IncidentID    TEXT   NOT NULL REFERENCES IR_Incident(ID),
						CreateAt      BIGINT NOT NULL,
					    DeleteAt      BIGINT NOT NULL DEFAULT 0,
						EventAt       BIGINT NOT NULL,
						EventType     TEXT   NOT NULL DEFAULT '',
						Summary       TEXT   NOT NULL DEFAULT '',
						Details       TEXT   NOT NULL DEFAULT '',
						PostID        TEXT   NOT NULL DEFAULT '',
					    SubjectUserID TEXT   NOT NULL DEFAULT '',
					    CreatorUserID TEXT   NOT NULL DEFAULT ''
					)
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_TimelineEvent")
				}

				if _, err := e.Exec(createPGIndex("IR_TimelineEvent_ID", "IR_TimelineEvent", "ID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_TimelineEvent_ID")
				}
				if _, err := e.Exec(createPGIndex("IR_TimelineEvent_IncidentID", "IR_TimelineEvent", "IncidentID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_TimelineEvent_IncidentID")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.7.0"),
		toVersion:   semver.MustParse("0.8.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "ReporterUserID", "varchar(26) NOT NULL DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ReporterUserID to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "ReporterUserID", "TEXT NOT NULL DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ReporterUserID to table IR_Incident")
				}
			}
			if _, err := e.Exec(`UPDATE IR_Incident SET ReporterUserID = CommanderUserID WHERE ReporterUserID = ''`); err != nil {
				return errors.Wrapf(err, "Failed to migrate ReporterUserID")
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.8.0"),
		toVersion:   semver.MustParse("0.9.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "ConcatenatedInvitedUserIDs", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedInvitedUserIDs to table IR_Incident")
				}
				if _, err := e.Exec("UPDATE IR_Incident SET ConcatenatedInvitedUserIDs = '' WHERE ConcatenatedInvitedUserIDs IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column ConcatenatedInvitedUserIDs of table IR_Incident")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "ConcatenatedInvitedUserIDs", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedInvitedUserIDs to table IR_Playbook")
				}
				if _, err := e.Exec("UPDATE IR_Playbook SET ConcatenatedInvitedUserIDs = '' WHERE ConcatenatedInvitedUserIDs IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column ConcatenatedInvitedUserIDs of table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "InviteUsersEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column InviteUsersEnabled to table IR_Playbook")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "ConcatenatedInvitedUserIDs", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedInvitedUserIDs to table IR_Incident")
				}
				if err := addColumnToPGTable(e, "IR_Playbook", "ConcatenatedInvitedUserIDs", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedInvitedUserIDs to table IR_Playbook")
				}
				if err := addColumnToPGTable(e, "IR_Playbook", "InviteUsersEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column InviteUsersEnabled to table IR_Playbook")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.9.0"),
		toVersion:   semver.MustParse("0.10.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "DefaultCommanderID", "VARCHAR(26) DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column DefaultCommanderID to table IR_Incident")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "DefaultCommanderID", "VARCHAR(26) DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column DefaultCommanderID to table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "DefaultCommanderEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column DefaultCommanderEnabled to table IR_Playbook")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "DefaultCommanderID", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column DefaultCommanderID to table IR_Incident")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "DefaultCommanderID", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column DefaultCommanderID to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "DefaultCommanderEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column DefaultCommanderEnabled to table IR_Playbook")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.10.0"),
		toVersion:   semver.MustParse("0.11.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`
					UPDATE IR_Incident
					INNER JOIN Channels ON IR_Incident.ChannelID = Channels.ID
					SET IR_Incident.CreateAt = Channels.CreateAt,
						IR_Incident.DeleteAt = Channels.DeleteAt
					WHERE IR_Incident.CreateAt = 0
						AND IR_Incident.DeleteAt = 0
						AND IR_Incident.ChannelID = Channels.ID
				`); err != nil {
					return errors.Wrap(err, "failed updating table IR_Incident with Channels' CreateAt and DeleteAt values")
				}
			} else {
				if _, err := e.Exec(`
					UPDATE IR_Incident
					SET CreateAt = Channels.CreateAt,
						DeleteAt = Channels.DeleteAt
					FROM Channels
					WHERE IR_Incident.CreateAt = 0
						AND IR_Incident.DeleteAt = 0
						AND IR_Incident.ChannelID = Channels.ID
				`); err != nil {
					return errors.Wrap(err, "failed updating table IR_Incident with Channels' CreateAt and DeleteAt values")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.11.0"),
		toVersion:   semver.MustParse("0.12.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "AnnouncementChannelID", "VARCHAR(26) DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column AnnouncementChannelID to table IR_Incident")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "AnnouncementChannelID", "VARCHAR(26) DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column AnnouncementChannelID to table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "AnnouncementChannelEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column AnnouncementChannelEnabled to table IR_Playbook")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "AnnouncementChannelID", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column AnnouncementChannelID to table IR_Incident")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "AnnouncementChannelID", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column AnnouncementChannelID to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "AnnouncementChannelEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column AnnouncementChannelEnabled to table IR_Playbook")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.12.0"),
		toVersion:   semver.MustParse("0.13.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "WebhookOnCreationURL", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnCreationURL to table IR_Incident")
				}
				if _, err := e.Exec("UPDATE IR_Incident SET WebhookOnCreationURL = '' WHERE WebhookOnCreationURL IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column WebhookOnCreationURL of table IR_Incident")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "WebhookOnCreationURL", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnCreationURL to table IR_Playbook")
				}
				if _, err := e.Exec("UPDATE IR_Playbook SET WebhookOnCreationURL = '' WHERE WebhookOnCreationURL IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column WebhookOnCreationURL of table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "WebhookOnCreationEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnCreationEnabled to table IR_Playbook")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "WebhookOnCreationURL", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnCreationURL to table IR_Incident")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "WebhookOnCreationURL", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnCreationURL to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "WebhookOnCreationEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnCreationEnabled to table IR_Playbook")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.13.0"),
		toVersion:   semver.MustParse("0.14.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "ConcatenatedInvitedGroupIDs", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedInvitedGroupIDs to table IR_Incident")
				}
				if _, err := e.Exec("UPDATE IR_Incident SET ConcatenatedInvitedGroupIDs = '' WHERE ConcatenatedInvitedGroupIDs IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column ConcatenatedInvitedGroupIDs of table IR_Incident")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "ConcatenatedInvitedGroupIDs", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedInvitedGroupIDs to table IR_Playbook")
				}
				if _, err := e.Exec("UPDATE IR_Playbook SET ConcatenatedInvitedGroupIDs = '' WHERE ConcatenatedInvitedGroupIDs IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column ConcatenatedInvitedGroupIDs of table IR_Playbook")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "ConcatenatedInvitedGroupIDs", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedInvitedGroupIDs to table IR_Incident")
				}
				if err := addColumnToPGTable(e, "IR_Playbook", "ConcatenatedInvitedGroupIDs", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedInvitedGroupIDs to table IR_Playbook")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.14.0"),
		toVersion:   semver.MustParse("0.15.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "Retrospective", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column Retrospective to table IR_Incident")
				}
				if _, err := e.Exec("UPDATE IR_Incident SET Retrospective = '' WHERE Retrospective IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column Retrospective of table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "Retrospective", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column Retrospective to table IR_Incident")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.15.0"),
		toVersion:   semver.MustParse("0.16.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "MessageOnJoin", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column MessageOnJoin to table IR_Playbook")
				}

				if _, err := e.Exec("UPDATE IR_Playbook SET MessageOnJoin = '' WHERE MessageOnJoin IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column MessageOnJoin of table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "MessageOnJoinEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column MessageOnJoinEnabled to table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Incident", "MessageOnJoin", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column MessageOnJoin to table IR_Incident")
				}

				if _, err := e.Exec("UPDATE IR_Incident SET MessageOnJoin = '' WHERE MessageOnJoin IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column MessageOnJoin of table IR_Incident")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_ViewedChannel
					(
						ChannelID     VARCHAR(26) NOT NULL,
						UserID        VARCHAR(26) NOT NULL,
						UNIQUE INDEX  IR_ViewedChannel_ChannelID_UserID (ChannelID, UserID)
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_ViewedChannel")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "MessageOnJoin", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column MessageOnJoin to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "MessageOnJoinEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column MessageOnJoinEnabled to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Incident", "MessageOnJoin", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column MessageOnJoin to table IR_Incident")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_ViewedChannel
					(
						ChannelID TEXT NOT NULL,
						UserID    TEXT NOT NULL
					)
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_ViewedChannel")
				}

				if _, err := e.Exec(createUniquePGIndex("IR_ViewedChannel_ChannelID_UserID", "IR_ViewedChannel", "ChannelID, UserID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_ViewedChannel_ChannelID_UserID")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.16.0"),
		toVersion:   semver.MustParse("0.17.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "RetrospectivePublishedAt", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectivePublishedAt to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "RetrospectivePublishedAt", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectivePublishedAt to table IR_Incident")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.17.0"),
		toVersion:   semver.MustParse("0.18.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "RetrospectiveReminderIntervalSeconds", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveReminderIntervalSeconds to table IR_Incident")
				}
				if err := addColumnToMySQLTable(e, "IR_Playbook", "RetrospectiveReminderIntervalSeconds", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveReminderIntervalSeconds to table IR_Playbook")
				}
				if err := addColumnToMySQLTable(e, "IR_Incident", "RetrospectiveWasCanceled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveWasCanceled to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "RetrospectiveReminderIntervalSeconds", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveReminderIntervalSeconds to table IR_Incident")
				}
				if err := addColumnToPGTable(e, "IR_Playbook", "RetrospectiveReminderIntervalSeconds", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveReminderIntervalSeconds to table IR_Playbook")
				}
				if err := addColumnToPGTable(e, "IR_Incident", "RetrospectiveWasCanceled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveWasCanceled to table IR_Incident")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.18.0"),
		toVersion:   semver.MustParse("0.19.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "RetrospectiveTemplate", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveReminderIntervalSeconds to table IR_Playbook")
				}

			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "RetrospectiveTemplate", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveReminderIntervalSeconds to table IR_Playbook")
				}
			}

			if _, err := e.Exec("UPDATE IR_Playbook SET RetrospectiveTemplate = '' WHERE RetrospectiveTemplate IS NULL"); err != nil {
				return errors.Wrapf(err, "failed setting default value in column RetrospectiveTemplate of table IR_Playbook")
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.19.0"),
		toVersion:   semver.MustParse("0.20.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "WebhookOnStatusUpdateURL", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnStatusUpdateURL to table IR_Playbook")
				}
				if _, err := e.Exec("UPDATE IR_Playbook SET WebhookOnStatusUpdateURL = '' WHERE WebhookOnStatusUpdateURL IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column WebhookOnStatusUpdateURL of table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "WebhookOnStatusUpdateEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnStatusUpdateEnabled to table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Incident", "WebhookOnStatusUpdateURL", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnStatusUpdateURL to table IR_Incident")
				}
				if _, err := e.Exec("UPDATE IR_Incident SET WebhookOnStatusUpdateURL = '' WHERE WebhookOnStatusUpdateURL IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column WebhookOnStatusUpdateURL of table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "WebhookOnStatusUpdateURL", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnStatusUpdateURL to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "WebhookOnStatusUpdateEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnStatusUpdateEnabled to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Incident", "WebhookOnStatusUpdateURL", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column WebhookOnStatusUpdateURL to table IR_Incident")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.20.0"),
		toVersion:   semver.MustParse("0.21.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "ConcatenatedSignalAnyKeywords", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedSignalAnyKeywords to table IR_Playbook")
				}
				if _, err := e.Exec("UPDATE IR_Playbook SET ConcatenatedSignalAnyKeywords = '' WHERE ConcatenatedSignalAnyKeywords IS NULL"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column ConcatenatedSignalAnyKeywords of table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "SignalAnyKeywordsEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column SignalAnyKeywordsEnabled to table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "UpdateAt", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column UpdateAt to table IR_Playbook")
				}
				if _, err := e.Exec("UPDATE IR_Playbook SET UpdateAt = CreateAt"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column UpdateAt of table IR_Playbook")
				}
				if _, err := e.Exec(`ALTER TABLE IR_Playbook ADD INDEX IR_Playbook_UpdateAt (UpdateAt)`); err != nil {
					me, ok := err.(*mysql.MySQLError)
					if !ok || me.Number != 1061 { // not a Duplicate key name error
						return errors.Wrapf(err, "failed creating index IR_Playbook_UpdateAt")
					}
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "ConcatenatedSignalAnyKeywords", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedSignalAnyKeywords to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "SignalAnyKeywordsEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column SignalAnyKeywordsEnabled to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "UpdateAt", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column UpdateAt to table IR_Playbook")
				}
				if _, err := e.Exec("UPDATE IR_Playbook SET UpdateAt = CreateAt"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column UpdateAt of table IR_Playbook")
				}
				if _, err := e.Exec(createPGIndex("IR_Playbook_UpdateAt", "IR_Playbook", "UpdateAt")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Playbook_UpdateAt")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.21.0"),
		toVersion:   semver.MustParse("0.22.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "LastStatusUpdateAt", "BIGINT DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column LastStatusUpdateAt to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "LastStatusUpdateAt", "BIGINT DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column LastStatusUpdateAt to table IR_Incident")
				}
			}

			var lastUpdateAts []struct {
				ID                 string
				LastStatusUpdateAt int64
			}

			// Fill in the LastStatusUpdateAt column as either the most recent status post, or
			// if no posts: the playbook run's CreateAt.
			lastUpdateAtSelect := sqlStore.builder.
				Select("i.Id as ID", "COALESCE(MAX(p.CreateAt), i.CreateAt) as LastStatusUpdateAt").
				From("IR_Incident as i").
				LeftJoin("IR_StatusPosts as sp on i.Id = sp.IncidentId").
				LeftJoin("Posts as p on sp.PostId = p.Id").
				GroupBy("i.Id")

			if err := sqlStore.selectBuilder(e, &lastUpdateAts, lastUpdateAtSelect); err != nil {
				return errors.Wrapf(err, "failed getting incidents to update their LastStatusUpdateAt")
			}

			for _, row := range lastUpdateAts {
				incidentUpdate := sqlStore.builder.
					Update("IR_Incident").
					Set("LastStatusUpdateAt", row.LastStatusUpdateAt).
					Where(sq.Eq{"ID": row.ID})

				if _, err := sqlStore.execBuilder(e, incidentUpdate); err != nil {
					return errors.Wrapf(err, "failed to update incident's LastStatusUpdateAt for id: %s", row.ID)
				}
			}

			return nil
		},
	},
	{

		fromVersion: semver.MustParse("0.22.0"),
		toVersion:   semver.MustParse("0.23.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {

				if err := addColumnToMySQLTable(e, "IR_Playbook", "ExportChannelOnArchiveEnabled", "BOOLEAN NOT NULL DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column ExportChannelOnArchiveEnabled to table IR_Playbook")
				}
				if err := addColumnToMySQLTable(e, "IR_Incident", "ExportChannelOnArchiveEnabled", "BOOLEAN NOT NULL DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column ExportChannelOnArchiveEnabled to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "ExportChannelOnArchiveEnabled", "BOOLEAN NOT NULL DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column ExportChannelOnArchiveEnabled to table IR_Playbook")
				}
				if err := addColumnToPGTable(e, "IR_Incident", "ExportChannelOnArchiveEnabled", "BOOLEAN NOT NULL DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column ExportChannelOnArchiveEnabled to table IR_Incident")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.23.0"),
		toVersion:   semver.MustParse("0.24.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "CategorizeChannelEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column CategorizeChannelEnabled to table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Incident", "CategorizeChannelEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column CategorizeChannelEnabled to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "CategorizeChannelEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column CategorizeChannelEnabled to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Incident", "CategorizeChannelEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column CategorizeChannelEnabled to table IR_Incident")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.24.0"),
		toVersion:   semver.MustParse("0.25.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := renameColumnMySQL(e, "IR_Playbook", "ExportChannelOnArchiveEnabled", "ExportChannelOnFinishedEnabled", "BOOLEAN NOT NULL DEFAULT FALSE"); err != nil {
					return errors.Wrap(err, "failed changing column ExportChannelOnArchiveEnabled to ExportChannelOnFinishedEnabled in table IR_Playbook")
				}

				if err := renameColumnMySQL(e, "IR_Incident", "ExportChannelOnArchiveEnabled", "ExportChannelOnFinishedEnabled", "BOOLEAN NOT NULL DEFAULT FALSE"); err != nil {
					return errors.Wrap(err, "failed changing column ExportChannelOnArchiveEnabled to ExportChannelOnFinishedEnabled in table IR_Incident")
				}

				if err := dropColumnMySQL(e, "IR_StatusPosts", "Status"); err != nil {
					return errors.Wrap(err, "failed dropping column Status in table IR_StatusPosts")
				}
			} else {
				if err := renameColumnPG(e, "IR_Playbook", "ExportChannelOnArchiveEnabled", "ExportChannelOnFinishedEnabled"); err != nil {
					return errors.Wrap(err, "failed changing column ExportChannelOnArchiveEnabled to ExportChannelOnFinishedEnabled in table IR_Playbook")
				}

				if err := renameColumnPG(e, "IR_Incident", "ExportChannelOnArchiveEnabled", "ExportChannelOnFinishedEnabled"); err != nil {
					return errors.Wrap(err, "failed changing column ExportChannelOnArchiveEnabled to ExportChannelOnFinishedEnabled in table IR_Incident")
				}

				if err := dropColumnPG(e, "IR_StatusPosts", "Status"); err != nil {
					return errors.Wrap(err, "failed dropping column Status in table IR_StatusPosts")
				}
			}

			if _, err := e.Exec(`
				UPDATE IR_Incident
				SET CurrentStatus =
						CASE
							WHEN CurrentStatus = 'Archived'
								THEN 'Finished'
							ELSE 'InProgress'
							END;
				`); err != nil {
				return errors.Wrap(err, "failed changing CurrentStatus to Archived or InProgress in table IR_Incident")
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.25.0"),
		toVersion:   semver.MustParse("0.26.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "CategoryName", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column CategoryName to table IR_Playbook")
				}

				if _, err := e.Exec("UPDATE IR_Playbook SET CategoryName = 'Playbook Runs' WHERE CategorizeChannelEnabled=1"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column CategoryName of table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Incident", "CategoryName", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column CategoryName to table IR_Incident")
				}

				if _, err := e.Exec("UPDATE IR_Incident SET CategoryName = 'Playbook Runs' WHERE CategorizeChannelEnabled=1"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column CategoryName of table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "CategoryName", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column CategoryName to table IR_Playbook")
				}

				if _, err := e.Exec("UPDATE IR_Playbook SET CategoryName = 'Playbook Runs' WHERE CategorizeChannelEnabled"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column CategoryName of table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Incident", "CategoryName", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column CategoryName to table IR_Incident")
				}

				if _, err := e.Exec("UPDATE IR_Incident SET CategoryName = 'Playbook Runs' WHERE CategorizeChannelEnabled"); err != nil {
					return errors.Wrapf(err, "failed setting default value in column CategoryName of table IR_Incident")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.26.0"),
		toVersion:   semver.MustParse("0.27.0"),
		// This deprecates columns BroadcastChannelID (in singular), AnnouncementChannelID and AnnouncementChannelEnabled
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			updateIncidentTableQuery := `
				UPDATE IR_Incident SET
					ConcatenatedBroadcastChannelIds = (
						COALESCE(
							CONCAT_WS(
								',',
								CASE WHEN AnnouncementChannelID = '' THEN NULL ELSE AnnouncementChannelID END,
								CASE WHEN BroadcastChannelID = ''  OR BroadcastChannelID = AnnouncementChannelID THEN NULL ELSE BroadcastChannelID END
							),
						'')
					)
			`

			updatePlaybookTableQuery := `
				UPDATE IR_Playbook SET
					ConcatenatedBroadcastChannelIds = (
						COALESCE(
							CONCAT_WS(
								',',
								CASE WHEN AnnouncementChannelID = '' THEN NULL ELSE AnnouncementChannelID END,
								CASE WHEN BroadcastChannelID = ''  OR BroadcastChannelID = AnnouncementChannelID THEN NULL ELSE BroadcastChannelID END
							),
						'')
					)
				, BroadcastEnabled = (CASE
					WHEN BroadcastChannelID != '' THEN TRUE
					WHEN AnnouncementChannelEnabled = TRUE THEN TRUE
					ELSE FALSE
				END)
			`

			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "ConcatenatedBroadcastChannelIds", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedBroadcastChannelIds to table IR_Incident")
				}

				if _, err := e.Exec(updateIncidentTableQuery); err != nil {
					return errors.Wrapf(err, "failed setting value in column ConcatenatedBroadcastChannelIds of table IR_Incident")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "ConcatenatedBroadcastChannelIds", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedBroadcastChannelIds to table IR_Playbook")
				}

				if err := addColumnToMySQLTable(e, "IR_Playbook", "BroadcastEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column BroadcastEnabled to table IR_Playbook")
				}

				if _, err := e.Exec(updatePlaybookTableQuery); err != nil {
					return errors.Wrapf(err, "failed setting value in columns ConcatenatedBroadcastChannelIds and BroadcastEnabled of table IR_Playbook")
				}

			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "ConcatenatedBroadcastChannelIds", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedBroadcastChannelIds to table IR_Incident")
				}

				if _, err := e.Exec(updateIncidentTableQuery); err != nil {
					return errors.Wrapf(err, "failed setting value in column ConcatenatedBroadcastChannelIds of table IR_Incident")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "ConcatenatedBroadcastChannelIds", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ConcatenatedBroadcastChannelIds to table IR_Playbook")
				}

				if err := addColumnToPGTable(e, "IR_Playbook", "BroadcastEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column BroadcastEnabled to table IR_Playbook")
				}

				if _, err := e.Exec(updatePlaybookTableQuery); err != nil {
					return errors.Wrapf(err, "failed setting value in columns ConcatenatedBroadcastChannelIds and BroadcastEnabled of table IR_Playbook")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.27.0"),
		toVersion:   semver.MustParse("0.28.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "ChannelIDToRootID", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ChannelIDToRootID to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "ChannelIDToRootID", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ChannelIDToRootID to table IR_Incident")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.28.0"),
		toVersion:   semver.MustParse("0.29.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`ALTER TABLE IR_System CONVERT TO CHARACTER SET utf8mb4`); err != nil {
					return errors.Wrapf(err, "failed to migrate character set")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.29.0"),
		toVersion:   semver.MustParse("0.30.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addPrimaryKey(e, sqlStore, "IR_PlaybookMember", "(MemberID, PlaybookID)"); err != nil {
					return err
				}
				if err := dropIndexIfExists(e, sqlStore, "IR_StatusPosts", "posts_unique"); err != nil {
					return err
				}
				if err := addPrimaryKey(e, sqlStore, "IR_StatusPosts", "(IncidentID, PostID)"); err != nil {
					return err
				}
				if err := addPrimaryKey(e, sqlStore, "IR_TimelineEvent", "(ID)"); err != nil {
					return err
				}
				if err := dropIndexIfExists(e, sqlStore, "IR_ViewedChannel", "IR_ViewedChannel_ChannelID_UserID"); err != nil {
					return err
				}
				if err := addPrimaryKey(e, sqlStore, "IR_ViewedChannel", "(ChannelID, UserID)"); err != nil {
					return err
				}
			} else {
				if err := addPrimaryKey(e, sqlStore, "ir_playbookmember", "(MemberID, PlaybookID)"); err != nil {
					return err
				}
				if err := addPrimaryKey(e, sqlStore, "ir_statusposts", "(IncidentID, PostID)"); err != nil {
					return err
				}
				if err := addPrimaryKey(e, sqlStore, "ir_timelineevent", "(ID)"); err != nil {
					return err
				}
				if err := addPrimaryKey(e, sqlStore, "ir_viewedchannel", "(ChannelID, UserID)"); err != nil {
					return err
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.30.0"),
		toVersion:   semver.MustParse("0.31.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			// Best effort migration so we just log the error to avoid killing the plugin.
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec("UPDATE IGNORE PluginKeyValueStore SET PluginId='playbooks' WHERE PluginId='com.mattermost.plugin-incident-management'"); err != nil {
					sqlStore.log.Debugf("%w", errors.Wrapf(err, "failed to migrate KV store plugin id"))
				}
			} else {

				if _, err := e.Exec("UPDATE PluginKeyValueStore k SET PluginId='playbooks' WHERE PluginId='com.mattermost.plugin-incident-management' AND NOT EXISTS ( SELECT 1 FROM PluginKeyValueStore WHERE PluginId='playbooks' AND PKey = k.PKey )"); err != nil {
					sqlStore.log.Debugf("%w", errors.Wrapf(err, "failed to migrate KV store plugin id"))
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.31.0"),
		toVersion:   semver.MustParse("0.32.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "ReminderTimerDefaultSeconds", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderTimerDefaultSeconds to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "ReminderTimerDefaultSeconds", "BIGINT NOT NULL DEFAULT 0"); err != nil {
					return errors.Wrapf(err, "failed adding column ReminderTimerDefaultSeconds to table IR_Incident")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.32.0"),
		toVersion:   semver.MustParse("0.33.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := renameColumnMySQL(e, "IR_Playbook", "WebhookOnCreationURL", "ConcatenatedWebhookOnCreationURLs", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed renaming column WebhookOnCreationURL to ConcatenatedWebhookOnCreationURLs in table IR_Playbook")
				}

				if err := renameColumnMySQL(e, "IR_Playbook", "WebhookOnStatusUpdateURL", "ConcatenatedWebhookOnStatusUpdateURLs", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed renaming column WebhookOnStatusUpdateURL to ConcatenatedWebhookOnStatusUpdateURLs in table IR_Playbook")
				}

				if err := renameColumnMySQL(e, "IR_Incident", "WebhookOnCreationURL", "ConcatenatedWebhookOnCreationURLs", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed renaming column WebhookOnCreationURL to ConcatenatedWebhookOnCreationURLs in table IR_Incident")
				}

				if err := renameColumnMySQL(e, "IR_Incident", "WebhookOnStatusUpdateURL", "ConcatenatedWebhookOnStatusUpdateURLs", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed renaming column WebhookOnStatusUpdateURL to ConcatenatedWebhookOnStatusUpdateURLs in table IR_Incident")
				}
			} else {
				if err := renameColumnPG(e, "IR_Playbook", "WebhookOnCreationURL", "ConcatenatedWebhookOnCreationURLs"); err != nil {
					return errors.Wrapf(err, "failed renaming column WebhookOnCreationURL to ConcatenatedWebhookOnCreationURLs in table IR_Playbook")
				}

				if err := renameColumnPG(e, "IR_Playbook", "WebhookOnStatusUpdateURL", "ConcatenatedWebhookOnStatusUpdateURLs"); err != nil {
					return errors.Wrapf(err, "failed renaming column WebhookOnStatusUpdateURL to ConcatenatedWebhookOnStatusUpdateURLs in table IR_Playbook")
				}

				if err := renameColumnPG(e, "IR_Incident", "WebhookOnCreationURL", "ConcatenatedWebhookOnCreationURLs"); err != nil {
					return errors.Wrapf(err, "failed renaming column WebhookOnCreationURL to ConcatenatedWebhookOnCreationURLs in table IR_Incident")
				}

				if err := renameColumnPG(e, "IR_Incident", "WebhookOnStatusUpdateURL", "ConcatenatedWebhookOnStatusUpdateURLs"); err != nil {
					return errors.Wrapf(err, "failed renaming column WebhookOnStatusUpdateURL to ConcatenatedWebhookOnStatusUpdateURLs in table IR_Incident")
				}

			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.33.0"),
		toVersion:   semver.MustParse("0.34.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_UserInfo
					(
						ID                VARCHAR(26) PRIMARY KEY,
						LastDailyTodoDMAt BIGINT
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_UserInfo")
				}
			} else {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_UserInfo
					(
						ID                TEXT PRIMARY KEY,
						LastDailyTodoDMAt BIGINT
					)
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_UserInfo")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.34.0"),
		toVersion:   semver.MustParse("0.35.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_UserInfo", "DigestNotificationSettingsJSON", "JSON"); err != nil {
					return errors.Wrapf(err, "failed adding column DigestNotificationSettings to table IR_UserInfo")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_UserInfo", "DigestNotificationSettingsJSON", "JSON"); err != nil {
					return errors.Wrapf(err, "failed adding column DigestNotificationSettings to table IR_UserInfo")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.35.0"),
		toVersion:   semver.MustParse("0.36.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if err := dropIndexIfExists(e, sqlStore, "IR_StatusPosts", "posts_unique"); err != nil {
				return err
			}

			return dropIndexIfExists(e, sqlStore, "IR_ViewedChannel", "IR_ViewedChannel_ChannelID_UserID")
		},
	},
	{
		fromVersion: semver.MustParse("0.36.0"),
		toVersion:   semver.MustParse("0.37.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			// Existing runs without a reminder need to have a reminder set; use 1 week from now.
			oneWeek := 7 * 24 * time.Hour

			// Get overdue runs
			overdueQuery := sqlStore.builder.
				Select("ID").
				From("IR_Incident").
				Where(sq.Eq{"CurrentStatus": app.StatusInProgress}).
				Where(sq.NotEq{"PreviousReminder": 0})
			if sqlStore.db.DriverName() == model.DatabaseDriverMysql {
				overdueQuery = overdueQuery.Where(sq.Expr("(PreviousReminder / 1e6 + LastStatusUpdateAt) <= FLOOR(UNIX_TIMESTAMP() * 1000)"))
			} else {
				overdueQuery = overdueQuery.Where(sq.Expr("(PreviousReminder / 1e6 + LastStatusUpdateAt) <= FLOOR(EXTRACT (EPOCH FROM now())::float*1000)"))
			}

			var runIDs []string
			if err := sqlStore.selectBuilder(sqlStore.db, &runIDs, overdueQuery); err != nil {
				return errors.Wrap(err, "failed to query for overdue runs")
			}

			// Get runs that never had a status update set
			otherQuery := sqlStore.builder.
				Select("ID").
				From("IR_Incident").
				Where(sq.Eq{"CurrentStatus": app.StatusInProgress}).
				Where(sq.Eq{"PreviousReminder": 0})

			var otherRunIDs []string
			if err := sqlStore.selectBuilder(sqlStore.db, &otherRunIDs, otherQuery); err != nil {
				return errors.Wrap(err, "failed to query for overdue runs")
			}

			// Set the new reminders
			runIDs = append(runIDs, otherRunIDs...)
			for _, ID := range runIDs {
				// Just in case (so we don't crash out during the migration) remove any old reminders
				sqlStore.scheduler.Cancel(ID)

				if _, err := sqlStore.scheduler.ScheduleOnce(ID, time.Now().Add(oneWeek)); err != nil {
					return errors.Wrapf(err, "failed to set new schedule for run id: %s", ID)
				}

				// Set the PreviousReminder, and pretend that this was a LastStatusUpdateAt so that
				// the reminder timers will show the correct time for when a status update is due.
				updatePrevReminderAndLastUpdateAt := sqlStore.builder.
					Update("IR_Incident").
					SetMap(map[string]interface{}{
						"PreviousReminder":   oneWeek,
						"LastStatusUpdateAt": model.GetMillis(),
					}).
					Where(sq.Eq{"ID": ID})
				if _, err := sqlStore.execBuilder(sqlStore.db, updatePrevReminderAndLastUpdateAt); err != nil {
					return errors.Wrap(err, "failed to update new PreviousReminder and LastStatusUpdateAt")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.37.0"),
		toVersion:   semver.MustParse("0.38.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_Run_Participants (
						IncidentID VARCHAR(26) NULL REFERENCES IR_Incident(ID),
						UserID VARCHAR(26) NOT NULL,
						IsFollower BOOLEAN NOT NULL,
						INDEX IR_Run_Participants_UserID (UserID),
						INDEX IR_Run_Participants_IncidentID (IncidentID)
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_Run_Participants")
				}
				if err := addPrimaryKey(e, sqlStore, "IR_Run_Participants", "(IncidentID, UserID)"); err != nil {
					return errors.Wrapf(err, "failed creating primary key for IR_Run_Participants")
				}
			} else {
				if _, err := e.Exec(`
				CREATE TABLE IF NOT EXISTS IR_Run_Participants (
					UserID TEXT NOT NULL,
					IncidentID TEXT NULL REFERENCES IR_Incident(ID),
					IsFollower BOOLEAN NOT NULL
				);
			`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_Run_Participants")
				}

				if err := addPrimaryKey(e, sqlStore, "ir_run_participants", "(IncidentID, UserID)"); err != nil {
					return errors.Wrapf(err, "failed creating primary key for ir_run_participants")
				}

				if _, err := e.Exec(createPGIndex("IR_Run_Participants_UserID", "IR_Run_Participants", "UserID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Run_Participants_UserID")
				}

				if _, err := e.Exec(createPGIndex("IR_Run_Participants_IncidentID", "IR_Run_Participants", "IncidentID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Run_Participants_IncidentID")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.38.0"),
		toVersion:   semver.MustParse("0.39.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "RunSummaryTemplate", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column RunSummaryTemplate to table IR_Playbook")
				}
				if _, err := e.Exec("UPDATE IR_Playbook SET RunSummaryTemplate = '' WHERE RunSummaryTemplate IS NULL"); err != nil {
					return errors.Wrapf(err, "failed updating default value of column RunSummaryTemplate from table IR_Playbook")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "RunSummaryTemplate", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column RunSummaryTemplate to table IR_Playbook")
				}
			}

			// Copy the values from the Description column, historically used for the run summary template, into the new RunSummaryTemplate column
			if _, err := e.Exec("UPDATE IR_Playbook SET RunSummaryTemplate = Description, Description = '' WHERE Description <> ''"); err != nil {
				return errors.Wrapf(err, "failed updating default value of column RunSummaryTemplate from table IR_Playbook")
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.39.0"),
		toVersion:   semver.MustParse("0.40.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_PlaybookAutoFollow (
						PlaybookID VARCHAR(26) NULL REFERENCES IR_Playbook(ID),
						UserID VARCHAR(26) NOT NULL
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_PlaybookAutoFollow")
				}
				if err := addPrimaryKey(e, sqlStore, "IR_PlaybookAutoFollow", "(PlaybookID, UserID)"); err != nil {
					return errors.Wrapf(err, "failed creating primary key for IR_PlaybookAutoFollow")
				}
			} else {
				if _, err := e.Exec(`
				CREATE TABLE IF NOT EXISTS IR_PlaybookAutoFollow (
					PlaybookID TEXT NULL REFERENCES IR_Playbook(ID),
					UserID TEXT NOT NULL
				);
			`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_PlaybookAutoFollow")
				}

				if err := addPrimaryKey(e, sqlStore, "ir_playbookautofollow", "(PlaybookID, UserID)"); err != nil {
					return errors.Wrapf(err, "failed creating primary key for IR_PlaybookAutoFollow")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.40.0"),
		toVersion:   semver.MustParse("0.41.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "ChannelNameTemplate", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column ChannelNameTemplate to table IR_Playbook")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "ChannelNameTemplate", "TEXT DEFAULT ''"); err != nil {
					return errors.Wrapf(err, "failed adding column ChannelNameTemplate to table IR_Playbook")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.41.0"),
		toVersion:   semver.MustParse("0.42.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "StatusUpdateEnabled", "BOOLEAN DEFAULT TRUE"); err != nil {
					return errors.Wrapf(err, "failed adding column StatusUpdateEnabled to table IR_Playbook")
				}
				if err := addColumnToMySQLTable(e, "IR_Incident", "StatusUpdateEnabled", "BOOLEAN DEFAULT TRUE"); err != nil {
					return errors.Wrapf(err, "failed adding column StatusUpdateEnabled to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "StatusUpdateEnabled", "BOOLEAN DEFAULT TRUE"); err != nil {
					return errors.Wrapf(err, "failed adding column StatusUpdateEnabled to table IR_Playbook")
				}
				if err := addColumnToPGTable(e, "IR_Incident", "StatusUpdateEnabled", "BOOLEAN DEFAULT TRUE"); err != nil {
					return errors.Wrapf(err, "failed adding column StatusUpdateEnabled to table IR_Incident")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.42.0"),
		toVersion:   semver.MustParse("0.43.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "RetrospectiveEnabled", "BOOLEAN DEFAULT TRUE"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveEnabled to table IR_Playbook")
				}
				if err := addColumnToMySQLTable(e, "IR_Incident", "RetrospectiveEnabled", "BOOLEAN DEFAULT TRUE"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveEnabled to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "RetrospectiveEnabled", "BOOLEAN DEFAULT TRUE"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveEnabled to table IR_Playbook")
				}
				if err := addColumnToPGTable(e, "IR_Incident", "RetrospectiveEnabled", "BOOLEAN DEFAULT TRUE"); err != nil {
					return errors.Wrapf(err, "failed adding column RetrospectiveEnabled to table IR_Incident")
				}
			}
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.43.0"),
		toVersion:   semver.MustParse("0.44.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_PlaybookMember", "Roles", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column Roles to table IR_Playbook")
				}
				if err := addColumnToMySQLTable(e, "IR_Playbook", "Public", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column Roles to table IR_Playbook")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_PlaybookMember", "Roles", "TEXT"); err != nil {
					return errors.Wrapf(err, "failed adding column Roles to table IR_Playbook")
				}
				if err := addColumnToPGTable(e, "IR_Playbook", "Public", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column Roles to table IR_Playbook")
				}
			}

			// Set all existing members to admins
			if _, err := e.Exec("UPDATE IR_PlaybookMember SET Roles = 'playbook_member playbook_admin' WHERE Roles IS NULL"); err != nil {
				return errors.Wrapf(err, "failed setting default value in column Roles of table IR_Playbook")
			}

			// Set all playbooks with no members as public
			if _, err := e.Exec("UPDATE IR_Playbook p SET Public = true WHERE NOT EXISTS(SELECT 1 FROM IR_PlaybookMember as pm WHERE pm.PlaybookID = p.ID)"); err != nil {
				return errors.Wrapf(err, "failed setting default value in column ConcatenatedSignalAnyKeywords of table IR_Playbook")
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.44.0"),
		toVersion:   semver.MustParse("0.45.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			// Existing runs without a reminder need to have a reminder set; use 1 week from now.
			oneWeek := 7 * 24 * time.Hour

			// Get runs whose reminder was dismissed (PreviousReminder was set to 0), but only for those
			// that have status updates enabled (or else they can't fix an overdue status update)
			dimissedQuery := sqlStore.builder.
				Select("ID").
				From("IR_Incident").
				Where(sq.Eq{"CurrentStatus": app.StatusInProgress}).
				Where(sq.Eq{"PreviousReminder": 0}).
				Where(sq.Eq{"StatusUpdateEnabled": true})

			var runIDs []string
			if err := sqlStore.selectBuilder(sqlStore.db, &runIDs, dimissedQuery); err != nil {
				return errors.Wrap(err, "failed to query for overdue runs")
			}

			// Set the new reminders
			for _, ID := range runIDs {
				// Just in case (so we don't crash out during the migration) remove any old reminders
				sqlStore.scheduler.Cancel(ID)

				if _, err := sqlStore.scheduler.ScheduleOnce(ID, time.Now().Add(oneWeek)); err != nil {
					return errors.Wrapf(err, "failed to set new schedule for run id: %s", ID)
				}

				// Set the PreviousReminder, and pretend that this was a LastStatusUpdateAt so that
				// the reminder timers will show the correct time for when a status update is due.
				updatePrevReminderAndLastUpdateAt := sqlStore.builder.
					Update("IR_Incident").
					SetMap(map[string]interface{}{
						"PreviousReminder":   oneWeek,
						"LastStatusUpdateAt": model.GetMillis(),
					}).
					Where(sq.Eq{"ID": ID})
				if _, err := sqlStore.execBuilder(sqlStore.db, updatePrevReminderAndLastUpdateAt); err != nil {
					return errors.Wrap(err, "failed to update new PreviousReminder and LastStatusUpdateAt")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.45.0"),
		toVersion:   semver.MustParse("0.46.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Playbook", "RunSummaryTemplateEnabled", "BOOLEAN DEFAULT TRUE"); err != nil {
					return errors.Wrapf(err, "failed adding column RunSummaryTemplateEnabled to table IR_Playbook")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Playbook", "RunSummaryTemplateEnabled", "BOOLEAN DEFAULT TRUE"); err != nil {
					return errors.Wrapf(err, "failed adding column RunSummaryTemplateEnabled to table IR_Playbook")
				}
			}

			// All playbooks that have an empty run summary should have their run summary disabled (it defaults to enabled)
			playbookUpdate := sqlStore.builder.
				Update("IR_Playbook").
				Set("RunSummaryTemplateEnabled", false).
				Where(sq.Eq{"RunSummaryTemplate": ""})

			if _, err := sqlStore.execBuilder(e, playbookUpdate); err != nil {
				return errors.Wrap(err, "failed updating RunSummaryTemplateEnabled")
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.46.0"),
		toVersion:   semver.MustParse("0.47.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			// set CurrentStatus = Finished for runs with EndAt > 0 || IsActive == false
			updateOldStatuses := sqlStore.builder.
				Update("IR_Incident").
				Set("CurrentStatus", app.StatusFinished).
				Where(sq.Or{
					sq.Gt{"EndAt": 0},
					sq.Eq{"IsActive": false},
				})

			if _, err := sqlStore.execBuilder(sqlStore.db, updateOldStatuses); err != nil {
				return errors.Wrap(err, "failed to update new CurrentStatus for old runs")
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.47.0"),
		toVersion:   semver.MustParse("0.48.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_MetricConfig (
					   ID VARCHAR(26) PRIMARY KEY,
					   PlaybookID VARCHAR(26) NOT NULL REFERENCES IR_Playbook(ID),
					   Title VARCHAR(512) NOT NULL,
					   Description VARCHAR(4096) NOT NULL,
					   Type VARCHAR(32) NOT NULL,
					   Target BIGINT NOT NULL,
					   Ordering TINYINT NOT NULL DEFAULT 0,
					   DeleteAt BIGINT NOT NULL DEFAULT 0,
					   INDEX IR_MetricConfig_PlaybookID (PlaybookID)
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_MetricConfig")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_Metric (
						IncidentID VARCHAR(26) NOT NULL REFERENCES IR_Incident(ID),
						MetricConfigID VARCHAR(26) NOT NULL REFERENCES IR_MetricConfig(ID),
						Value BIGINT NOT NULL,
						Published BOOLEAN NOT NULL,
						INDEX IR_Metric_IncidentID (IncidentID),
						INDEX IR_Metric_MetricConfigID (MetricConfigID)
				 	)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_Metric")
				}

				if err := addPrimaryKey(e, sqlStore, "IR_Metric", "(IncidentID, MetricConfigID)"); err != nil {
					return errors.Wrapf(err, "failed creating primary key for IR_Metric")
				}
			} else {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_MetricConfig (
						ID TEXT PRIMARY KEY,
						PlaybookID TEXT NOT NULL REFERENCES IR_Playbook(ID),
						Title TEXT NOT NULL,
						Description TEXT NOT NULL,
						Type TEXT NOT NULL,
						Target BIGINT NOT NULL,
						Ordering SMALLINT NOT NULL DEFAULT 0,
						DeleteAt BIGINT NOT NULL DEFAULT 0
					)
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_MetricConfig")
				}

				if _, err := e.Exec(createPGIndex("IR_MetricConfig_PlaybookID", "IR_MetricConfig", "PlaybookID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_MetricConfig_PlaybookID")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_Metric (
						IncidentID TEXT NOT NULL REFERENCES IR_Incident(ID),
						MetricConfigID TEXT NOT NULL REFERENCES IR_MetricConfig(ID),
						Value BIGINT NOT NULL,
						Published BOOLEAN NOT NULL
					)
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_Metric")
				}

				if err := addPrimaryKey(e, sqlStore, "ir_metric", "(IncidentID, MetricConfigID)"); err != nil {
					return errors.Wrapf(err, "failed creating primary key for IR_Metric")
				}

				if _, err := e.Exec(createPGIndex("IR_Metric_IncidentID", "IR_Metric", "IncidentID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Metric_IncidentID")
				}
				if _, err := e.Exec(createPGIndex("IR_Metric_MetricConfigID", "IR_Metric", "MetricConfigID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Metric_MetricConfigID")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.48.0"),
		toVersion:   semver.MustParse("0.49.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`ALTER TABLE IR_MetricConfig MODIFY COLUMN Target BIGINT`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_MetricConfig")
				}
				if _, err := e.Exec(`ALTER TABLE IR_Metric MODIFY COLUMN Value BIGINT`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_MetricConfig")
				}
			} else {
				if _, err := e.Exec(`ALTER TABLE IR_MetricConfig ALTER COLUMN Target DROP NOT NULL`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_MetricConfig")
				}
				if _, err := e.Exec(`ALTER TABLE IR_Metric ALTER COLUMN Value DROP NOT NULL`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_MetricConfig")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.49.0"),
		toVersion:   semver.MustParse("0.50.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_ChannelAction (
						ID VARCHAR(26) PRIMARY KEY,
						ChannelID VARCHAR(26),
						Enabled BOOLEAN DEFAULT FALSE,
						DeleteAt BIGINT NOT NULL DEFAULT 0,
						ActionType TEXT NOT NULL,
						TriggerType TEXT NOT NULL,
						Payload JSON NOT NULL,
						INDEX IR_ChannelAction_ChannelID (ChannelID)
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_ChannelAction")
				}
			} else {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_ChannelAction (
						ID TEXT PRIMARY KEY,
						ChannelID VARCHAR(26),
						Enabled BOOLEAN DEFAULT FALSE,
						DeleteAt BIGINT NOT NULL DEFAULT 0,
						ActionType TEXT NOT NULL,
						TriggerType TEXT NOT NULL,
						Payload JSON NOT NULL
					)
				`); err != nil {
					return errors.Wrapf(err, "failed creating table IR_ChannelAction")
				}

				if _, err := e.Exec(createPGIndex("IR_ChannelAction_ChannelID", "IR_ChannelAction", "ChannelID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_ChannelAction_ChannelID")
				}
			}

			// Retrieve the channel ID and welcome message of every run

			selectQuery := sqlStore.builder.
				Select("ChannelID", "MessageOnJoin").
				From("IR_Incident").
				Where(sq.And{
					sq.NotEq{"MessageOnJoin": ""},
				})

			var rows []struct {
				ChannelID     string
				MessageOnJoin string
			}

			if err := sqlStore.selectBuilder(e, &rows, selectQuery); err != nil {
				return errors.Wrapf(err, "failed to retrieve the ChannelID and MessageOnJoin from IR_Incident")
			}

			// Create a new action for every row returned before

			if len(rows) > 0 {
				insertQuery := sqlStore.builder.
					Insert("IR_ChannelAction").
					Columns("ID", "ChannelID", "Enabled", "ActionType", "TriggerType", "Payload")

				for _, row := range rows {
					payload := struct {
						Message string
					}{row.MessageOnJoin}

					payloadJSON, err := json.Marshal(payload)
					if err != nil {
						return errors.Wrapf(err, "failed to marshal welcome message payload: %v", payload)
					}

					insertQuery = insertQuery.Values(model.NewId(), row.ChannelID, true, "send_welcome_message", "new_member_joins", payloadJSON)
				}

				if _, err := sqlStore.execBuilder(e, insertQuery); err != nil {
					return errors.Wrapf(err, "failed to create the channel actions for the existing runs")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.50.0"),
		toVersion:   semver.MustParse("0.51.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			// Retrieve the channel ID and category name of every run

			selectQuery := sqlStore.builder.
				Select("ChannelID", "CategoryName").
				From("IR_Incident").
				Where(sq.NotEq{"CategoryName": ""})

			var rows []struct {
				ChannelID    string
				CategoryName string
			}

			if err := sqlStore.selectBuilder(e, &rows, selectQuery); err != nil {
				return errors.Wrapf(err, "failed to retrieve the ChannelID and CategoryName from IR_Incident")
			}

			// Create a new action for every row returned before

			if len(rows) > 0 {
				insertQuery := sqlStore.builder.
					Insert("IR_ChannelAction").
					Columns("ID", "ChannelID", "Enabled", "ActionType", "TriggerType", "Payload")

				for _, row := range rows {
					payload := struct {
						CategoryName string `json:"category_name"`
					}{row.CategoryName}

					payloadJSON, err := json.Marshal(payload)
					if err != nil {
						return errors.Wrapf(err, "failed to marshal category name payload: %v", payload)
					}

					insertQuery = insertQuery.Values(model.NewId(), row.ChannelID, true, "categorize_channel", "new_member_joins", payloadJSON)
				}

				if _, err := sqlStore.execBuilder(e, insertQuery); err != nil {
					return errors.Wrapf(err, "failed to create the channel actions for the existing runs")
				}
			}

			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.51.0"),
		toVersion:   semver.MustParse("0.52.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			// moved migration code to the next version to remove an unnecessary column
			return nil
		},
	},
	{
		fromVersion: semver.MustParse("0.52.0"),
		toVersion:   semver.MustParse("0.53.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if err := addColumnToMySQLTable(e, "IR_Incident", "StatusUpdateBroadcastChannelsEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column StatusUpdateBroadcastChannelsEnabled to table IR_Incident")
				}
				if err := dropColumnMySQL(e, "IR_Incident", "StatusUpdateBroadcastFollowersEnabled"); err != nil {
					return errors.Wrapf(err, "failed dropping column StatusUpdateBroadcastFollowersEnabled from table IR_Incident")
				}
				if err := addColumnToMySQLTable(e, "IR_Incident", "StatusUpdateBroadcastWebhooksEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column StatusUpdateBroadcastWebhooksEnabled to table IR_Incident")
				}
			} else {
				if err := addColumnToPGTable(e, "IR_Incident", "StatusUpdateBroadcastChannelsEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column StatusUpdateBroadcastChannelsEnabled to table IR_Incident")
				}
				if err := dropColumnPG(e, "IR_Incident", "StatusUpdateBroadcastFollowersEnabled"); err != nil {
					return errors.Wrapf(err, "failed dropping column StatusUpdateBroadcastFollowersEnabled from table IR_Incident")
				}
				if err := addColumnToPGTable(e, "IR_Incident", "StatusUpdateBroadcastWebhooksEnabled", "BOOLEAN DEFAULT FALSE"); err != nil {
					return errors.Wrapf(err, "failed adding column StatusUpdateBroadcastWebhooksEnabled to table IR_Incident")
				}
			}

			// enable channels broadcast where channels ids list is not empty
			channelsBroadcast := sqlStore.builder.
				Update("IR_Incident").
				Set("StatusUpdateBroadcastChannelsEnabled", true).
				Where(sq.NotEq{"ConcatenatedBroadcastChannelIDs": ""})

			if _, err := sqlStore.execBuilder(e, channelsBroadcast); err != nil {
				return errors.Wrapf(err, "failed updating the StatusUpdateBroadcastChannelsEnabled column")
			}

			// enable webhooks broadcast where webhooks list is not empty
			webhooksBroadcast := sqlStore.builder.
				Update("IR_Incident").
				Set("StatusUpdateBroadcastWebhooksEnabled", true).
				Where(sq.NotEq{"ConcatenatedWebhookOnStatusUpdateURLs": ""})

			if _, err := sqlStore.execBuilder(e, webhooksBroadcast); err != nil {
				return errors.Wrapf(err, "failed updating the StatusUpdateBroadcastWebhooksEnabled column")
			}

			return nil
		},
	},
}
