UPDATE posts p
 SET props= props - 'playbookRunId'
 FROM ir_incident i
 WHERE i.reminderpostid=p.id
   AND p.deleteat=0
   AND p.type='custom_update_status'
   AND p.props -> 'playbookRunId' IS NOT NULL;
