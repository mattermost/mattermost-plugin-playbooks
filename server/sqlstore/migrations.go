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
					ID VARCHAR(26) PRIMARY KEY,
					Name VARCHAR(26) NOT NULL,
					IsActive BOOLEAN NOT NULL,
					CommanderUserID VARCHAR(26) NOT NULL,
					TeamID VARCHAR(26) NOT NULL,
					ChannelID VARCHAR(26) NOT NULL,
					CreateAt BIGINT NOT NULL,
					EndedAt BIGINT NOT NULL DEFAULT 0,
					DeleteAt BIGINT NOT NULL DEFAULT 0,
					ActiveStage BIGINT NOT NULL,
					PostID VARCHAR(26) NOT NULL DEFAULT '',
					PlaybookID VARCHAR(26) NOT NULL REFERENCES Playbook(ID)
				);
			`)
			if err != nil {
				return err
			}

			return nil
		},
	},
}
