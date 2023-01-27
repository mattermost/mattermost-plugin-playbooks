UPDATE posts p
SET props=jsonb_insert(props,'{playbookRunId}', CONCAT('"',i.id,'"')::jsonb)
FROM ir_incident i
WHERE i.reminderpostid = p.id
  AND p.deleteat = 0
  AND p.type = 'custom_update_status'
  AND p.props -> 'playbookRunId' IS NULL;

-- EXPLAIN
-- Update on posts p  (cost=2023.18..2474.30 rows=1 width=331)
--   ->  Hash Join  (cost=2023.18..2474.30 rows=1 width=331)
--         Hash Cond: ((i.reminderpostid)::text = (p.id)::text)
--         ->  Seq Scan on ir_incident i  (cost=0.00..438.82 rows=4682 width=35)
--         ->  Hash  (cost=2023.16..2023.16 rows=1 width=365)
--               ->  Seq Scan on posts p  (cost=0.00..2023.16 rows=1 width=365)
--                     Filter: (((props -> 'playbookRunId'::text) IS NULL) AND (deleteat = 0) AND ((type)::text = 'custom_update_status'::text))
