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
				CREATE TABLE Incident (
					ID VARCHAR(26) PRIMARY KEY,
					Name VARCHAR(26) NOT NULL,
					IsActive BOOLEAN NOT NULL,
					CommanderUserID VARCHAR(26) NOT NULL,
					TeamID VARCHAR(26) NOT NULL,
					ChannelID VARCHAR(26) NOT NULL UNIQUE, -- should change the field name at the same time
					CreateAt BIGINT NOT NULL, -- should change the field name at the same time
					EndedAt BIGINT NOT NULL DEFAULT 0,
					DeleteAt BIGINT NOT NULL DEFAULT 0,
					ActiveStage BIGINT NOT NULL,
					PostID VARCHAR(26) NOT NULL DEFAULT '',
					PlaybookID VARCHAR(26) NOT NULL REFERENCES Playbook(ID)
				);

				CREATE INDEX Incident_TeamID ON Incident(TeamID);
				CREATE INDEX Incident_TeamID_CommanderUserID ON Incident(TeamID, CommanderUserID);
				CREATE INDEX Incident_ChannelID ON Incident(ChannelID);

				CREATE TABLE Playbook (
					ID VARCHAR(26) PRIMARY KEY,
					Title VARCHAR(65535) NOT NULL,
					TeamID VARCHAR(26) NOT NULL,
					CreatePublicIncident BOOLEAN NOT NULL,
					CreateAt BIGINT NOT NULL,
					DeleteAt BIGINT NOT NULL DEFAULT 0,
					InBackstage BOOLEAN NOT NULL DEFAULT FALSE
				);

				CREATE INDEX Playbook_TeamID ON Playbook(TeamID);

				CREATE TABLE PlaybookMember (
					PlaybookID VARCHAR(26) NOT NULL REFERENCES Playbook(ID)
					MemberID VARCHAR(26) NOT NULL,
				);

				CREATE INDEX PlaybookMemberIDs_PlaybookID ON PlaybookMemberIDs(PlaybookID);

				CREATE TABLE Checklist (
					ID VARCHAR(26) PRIMARY KEY,
					Title VARCHAR(65535) NOT NULL,
					Sequence BIGINT NOT NULL,
					PlaybookID VARCHAR(26) NOT NULL REFERENCES Playbook(ID)
				);

				CREATE INDEX Checklist_PlaybookID ON Checklist(PlaybookID);

				CREATE TABLE ChecklistItem (
					ID VARCHAR(26) PRIMARY KEY,
					Title VARCHAR(65535) NOT NULL,
					State VARCHAR(32) NOT NULL DEFAULT '',
					StateModified BIGINT NOT NULL DEFAULT 0, --  should change the field type at the same time
					StateModifiedPostID VARCHAR(26) NOT NULL DEFAULT '',
					AssigneeID VARCHAR(26) NOT NULL DEFAULT '',
					AssigneeModified BIGINT NOT NULL DEFAULT 0, --  should change the field type at the same time
					AssigneeModifiedPostID VARCHAR(26) NOT NULL DEFAULT '',
					Command VARCHAR(65535) NOT NULL,
					DeleteAt BIGINT NOT NULL DEFAULT 0,
					Sequence BIGINT NOT NULL,
					ChecklistID VARCHAR(26) NOT NULL REFERENCES Checklist(ID)
				);

				CREATE INDEX ChecklistItem_ChecklistID ON ChecklistItem(ChecklistID);
			`)
			if err != nil {
				return err
			}

			return nil
		},
	},
}
