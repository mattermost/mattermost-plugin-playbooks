ALTER TABLE IR_Incident ADD COLUMN UpdateAt BIGINT NOT NULL DEFAULT 0;
UPDATE IR_Incident SET UpdateAt = CreateAt;