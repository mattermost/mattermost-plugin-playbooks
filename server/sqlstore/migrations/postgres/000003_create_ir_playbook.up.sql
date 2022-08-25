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

CREATE INDEX IF NOT EXISTS IR_Playbook_TeamID ON IR_Playbook (TeamID);
