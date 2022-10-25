ALTER TABLE IR_Incident ADD COLUMN IF NOT EXISTS LastStatusUpdateAt BIGINT DEFAULT 0;

UPDATE IR_Incident as dest
SET LastStatusUpdateAt = src.LastStatusUpdateAt
FROM (
  SELECT i.Id as ID, COALESCE(MAX(p.CreateAt), i.CreateAt) as LastStatusUpdateAt
  FROM IR_Incident as i
  LEFT JOIN IR_StatusPosts as sp on i.Id = sp.IncidentId
  LEFT JOIN Posts as p on sp.PostId = p.Id
  GROUP BY i.Id
) as src
WHERE dest.ID = src.ID;
