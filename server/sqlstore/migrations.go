package sqlstore

import (
	"fmt"

	"github.com/blang/semver"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type Migration struct {
	fromVersion   semver.Version
	toVersion     semver.Version
	migrationFunc func(execer) error
}

var migrations = []Migration{
	{
		fromVersion: semver.MustParse("0.0.0"),
		toVersion:   semver.MustParse("0.1.0"),
		migrationFunc: func(e execer) error {
			if _, err := e.Exec(`
				CREATE TABLE IF NOT EXISTS IR_System (
					SKey VARCHAR(64) PRIMARY KEY,
					SValue VARCHAR(1024) NULL
				);
			`); err != nil {
				return errors.Wrapf(err, "failed creating table IR_System")
			}

			if e.DriverName() == model.DATABASE_DRIVER_MYSQL {
				charset := "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci"

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
				` + charset); err != nil {
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
				` + charset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_Playbook")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS IR_PlaybookMember (
						PlaybookID VARCHAR(26) NOT NULL REFERENCES IR_Playbook(ID),
						MemberID VARCHAR(26) NOT NULL,
						INDEX IR_PlaybookMember_PlaybookID (PlaybookID),
						INDEX IR_PlaybookMember_MemberID (MemberID)
					)
				` + charset); err != nil {
					return errors.Wrapf(err, "failed creating table IR_PlaybookMember")
				}
			} else {
				if _, err := e.Exec(`
					CREATE EXTENSION IF NOT EXISTS unaccent;
				`); err != nil {
					return errors.Wrapf(err, "failed creating extension unaccent")
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

				// 'IF NOT EXISTS' syntax is not supported in 9.4, so we need
				// this workaround to make the migration idempotent
				createIndex := func(indexName, tableName, columns string) string {
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

				if _, err := e.Exec(createIndex("IR_Incident_TeamID", "IR_Incident", "TeamID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Incident_TeamID")
				}

				if _, err := e.Exec(createIndex("IR_Incident_TeamID_CommanderUserID", "IR_Incident", "TeamID, CommanderUserID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Incident_TeamID_CommanderUserID")
				}

				if _, err := e.Exec(createIndex("IR_Incident_ChannelID", "IR_Incident", "ChannelID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Incident_ChannelID")
				}

				if _, err := e.Exec(createIndex("IR_Playbook_TeamID", "IR_Playbook", "TeamID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_Playbook_TeamID")
				}

				if _, err := e.Exec(createIndex("IR_PlaybookMember_PlaybookID", "IR_PlaybookMember", "PlaybookID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_PlaybookMember_PlaybookID")
				}

				if _, err := e.Exec(createIndex("IR_PlaybookMember_MemberID", "IR_PlaybookMember", "MemberID")); err != nil {
					return errors.Wrapf(err, "failed creating index IR_PlaybookMember_MemberID ")
				}
			}

			return nil
		},
	},
}
