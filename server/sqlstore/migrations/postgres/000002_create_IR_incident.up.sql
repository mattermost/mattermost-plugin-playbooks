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

DO $$
BEGIN
	IF to_regclass ('IR_Incident_TeamID') IS NULL THEN
		CREATE INDEX IR_Incident_TeamID ON IR_Incident (TeamID);
	END IF;
END
$$;

DO $$
BEGIN
	IF to_regclass ('IR_Incident_TeamID_CommanderUserID') IS NULL THEN
		CREATE INDEX IR_Incident_TeamID_CommanderUserID ON IR_Incident (TeamID, CommanderUserID);
	END IF;
END
$$;

DO $$
BEGIN
	IF to_regclass ('IR_Incident_ChannelID') IS NULL THEN
		CREATE INDEX IR_Incident_ChannelID ON IR_Incident (ChannelID);
	END IF;
END
$$;
