ALTER TABLE IR_Playbook DROP COLUMN IF EXISTS ChannelID;
ALTER TABLE IR_Playbook DROP COLUMN IF EXISTS ChannelMode;

-- add unique constraint to channelid index
ALTER TABLE IR_Incident  ADD CONSTRAINT ir_incident_channelid_key UNIQUE(ChannelID);

