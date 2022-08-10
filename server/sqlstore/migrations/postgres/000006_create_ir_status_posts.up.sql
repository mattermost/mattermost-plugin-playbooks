CREATE TABLE IF NOT EXISTS IR_StatusPosts (
    IncidentID TEXT NOT NULL REFERENCES IR_Incident(ID),
    PostID TEXT NOT NULL,
    UNIQUE (IncidentID, PostID)
);

DO $$
BEGIN
	IF to_regclass ('IR_StatusPosts_IncidentID') IS NULL THEN
		CREATE INDEX IR_StatusPosts_IncidentID ON IR_StatusPosts (IncidentID);
	END IF;
END
$$;

DO $$
BEGIN
	IF to_regclass ('IR_StatusPosts_PostID') IS NULL THEN
		CREATE INDEX IR_StatusPosts_PostID ON IR_StatusPosts (PostID);
	END IF;
END
$$;
