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

DO $$
BEGIN
	IF to_regclass ('IR_Playbook_TeamID') IS NULL THEN
		CREATE INDEX IR_Playbook_TeamID ON IR_Playbook (TeamID);
	END IF;
END
$$;

DO $$
BEGIN
	IF to_regclass ('IR_PlaybookMember_PlaybookID') IS NULL THEN
		CREATE INDEX IR_PlaybookMember_PlaybookID ON IR_Playbook (ID);
	END IF;
END
$$;
