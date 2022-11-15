ALTER TABLE IR_Playbook DROP COLUMN IF EXISTS ChannelID;
ALTER TABLE IR_Playbook DROP COLUMN IF EXISTS ChannelMode;

-- Drop unique constraint and kee the index
ALTER TABLE IR_Incident  ADD CONSTRAINT ir_incident_channelid_key UNIQUE(ChannelID);

-- update empty names on incident table with channels data
UPDATE IR_Incident i
SET name=c.DisplayName
FROM Channels c
WHERE  c.id=i.ChannelID AND i.Name='';
