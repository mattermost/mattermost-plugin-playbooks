CREATE TABLE IF NOT EXISTS IR_IncomingWebhook (
    ID            TEXT PRIMARY KEY,
    Name          TEXT NOT NULL,
    CreatorID     TEXT NOT NULL,
    TeamID        TEXT NOT NULL,
    PlaybookID    TEXT DEFAULT '',
    PlaybookRunID TEXT DEFAULT '',
    CreateAt      BIGINT NOT NULL DEFAULT 0,
    UpdateAt      BIGINT NOT NULL DEFAULT 0,
    DeleteAt      BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ir_incoming_webhook_playbook ON IR_IncomingWebhook (PlaybookID) WHERE DeleteAt = 0;
CREATE INDEX IF NOT EXISTS idx_ir_incoming_webhook_run ON IR_IncomingWebhook (PlaybookRunID) WHERE DeleteAt = 0;
