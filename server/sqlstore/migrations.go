package sqlstore

import (
	"database/sql"

	"github.com/blang/semver"
)

type Migration struct {
	fromVersion   semver.Version
	toVersion     semver.Version
	migrationFunc func(*sql.DB) error
}

var migrations = []Migration{
	{
		fromVersion: semver.MustParse("0.0.0"),
		toVersion:   semver.MustParse("0.1.0"),
		migrationFunc: func(db *sql.DB) error {
			_, err := db.Exec(`
				CREATE TABLE IR_Incident (
					ID TEXT/VARCHAR(26) PRIMARY KEY,
					Name TEXT/VARCHAR(26) NOT NULL,
					IsActive BOOLEAN NOT NULL,
					CommanderUserID TEXT/VARCHAR(26) NOT NULL,
					TeamID TEXT/VARCHAR(26) NOT NULL,
					ChannelID TEXT/VARCHAR(26) NOT NULL UNIQUE,
					CreateAt BIGINT NOT NULL,
					EndAt BIGINT NOT NULL DEFAULT 0,
					DeleteAt BIGINT NOT NULL DEFAULT 0,
					ActiveStage BIGINT NOT NULL,
					PostID TEXT/VARCHAR(26) NOT NULL DEFAULT '',
					PlaybookID TEXT/VARCHAR(26) NOT NULL DEFAULT '',
					ChecklistsJSON JSON/VARCHAR(65535) NOT NULL
				);

				CREATE INDEX IR_Incident_TeamID ON IR_Incident (TeamID);
				CREATE INDEX IR_Incident_TeamID_CommanderUserID ON IR_Incident (TeamID, CommanderUserID);
				CREATE INDEX IR_Incident_ChannelID ON IR_Incident (ChannelID);

				CREATE TABLE IR_Playbook (
					ID TEXT/VARCHAR(26) PRIMARY KEY,
					Title TEXT/VARCHAR(65535) NOT NULL,
					TeamID TEXT/VARCHAR(26) NOT NULL,
					CreatePublicIncident BOOLEAN NOT NULL,
					CreateAt BIGINT NOT NULL,
					DeleteAt BIGINT NOT NULL DEFAULT 0,
					Checklists JSON/VARCHAR(65535) NOT NULL
				);

				CREATE INDEX IR_Playbook_TeamID ON IR_Playbook(TeamID);

				CREATE TABLE IR_PlaybookMember (
					PlaybookID TEXT/VARCHAR(26) NOT NULL REFERENCES IR_Playbook(ID),
					MemberID TEXT/VARCHAR(26) NOT NULL
				);

				CREATE INDEX IR_PlaybookMember_PlaybookID ON IR_PlaybookMember(PlaybookID);
			`)
			if err != nil {
				return err
			}

			return nil
		},
	},
}
