CREATE TABLE IF NOT EXISTS IR_Checklist (
	ID TEXT PRIMARY KEY,
	Title TEXT NOT NULL,
    Position SMALLINT NOT NULL DEFAULT 0,
    PlaybookRunID TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS IR_Checklist_PlaybookRunID ON IR_Checklist (PlaybookRunID);

CREATE TABLE IF NOT EXISTS IR_Checklist_Item (
	ID TEXT PRIMARY KEY,
	Title TEXT NOT NULL,
    State TEXT NOT NULL,
    StateModified BIGINT NOT NULL DEFAULT 0,
    AssigneeID TEXT NOT NULL,
    AssigneeModified BIGINT NOT NULL DEFAULT 0,
    Command TEXT NOT NULL,
    CommandLastRun BIGINT NOT NULL DEFAULT 0,
    Description TEXT NOT NULL,
    LastSkipped BIGINT NOT NULL DEFAULT 0,
    DueDate BIGINT NOT NULL DEFAULT 0,
    Position SMALLINT NOT NULL DEFAULT 0,
    ChecklistID TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS IR_Checklist_Item_ChecklistID ON IR_Checklist_Item (ChecklistID);

-- Update rows in table 'IR_Checklist'
INSERT INTO IR_Checklist
SELECT
	Checklists.Checklsit->>'id' AS ID,
	Checklists.Checklsit->>'title' AS Title,
	Checklists.Position-1 AS Position,
	IR_Incident.id AS PlaybookRunID
FROM
	IR_Incident, 
	json_array_elements(checklistsjson) with ordinality Checklists(Checklsit, Position);

-- Update rows in table 'IR_Checklist_Item'
INSERT INTO IR_Checklist_Item
SELECT
	t1.ID AS ID,
	Items.item->>'title' AS Title,
    Items.item->>'state' AS State,
    (Items.item->>'state_modified')::BIGINT AS StateModified,
    Items.item->>'assignee_id' AS AssigneeID,
    (Items.item->>'assignee_modified')::BIGINT AS AssigneeModified,
    Items.item->>'command' AS Command,
    (Items.item->>'command_last_run')::BIGINT AS CommandLastRun,
    Items.item->>'description' AS Description,
    (Items.item->>'delete_at')::BIGINT AS LastSkipped,
    (Items.item->>'due_date')::BIGINT AS DueDate,
    (Items.Position-1)::SMALLINT AS Position,
    t1.ID AS ChecklistID
FROM
	(SELECT 
		Checklists.Checklsit->>'id' AS ID,
		IR_Incident.id AS PlaybookRunID,
		Checklists.Checklsit->'items' AS Items
	FROM 
		IR_Incident, 
		json_array_elements(checklistsjson) with ordinality Checklists(Checklsit, Position)
	) AS t1,
	json_array_elements(t1.Items) with ordinality Items(item, Position);
