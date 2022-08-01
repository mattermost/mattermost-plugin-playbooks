CREATE TABLE IF NOT EXISTS IR_PlaybookMember (
    PlaybookID TEXT NOT NULL REFERENCES IR_Playbook(ID),
    MemberID TEXT NOT NULL,
    UNIQUE (PlaybookID, MemberID)
);


DO $$
BEGIN
	IF to_regclass ('IR_PlaybookMember_PlaybookID') IS NULL THEN
		CREATE INDEX IR_PlaybookMember_PlaybookID ON IR_PlaybookMember (PlaybookID);
	END IF;
END
$$;

DO $$
BEGIN
	IF to_regclass ('IR_PlaybookMember_MemberID') IS NULL THEN
		CREATE INDEX IR_PlaybookMember_MemberID ON IR_PlaybookMember (MemberID);
	END IF;
END
$$;
