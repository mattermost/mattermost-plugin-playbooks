# Database outage \#42

## Executive summary

Primary DB failed over. **Resolved** by `@alice`.

- Replica promoted
- Traffic drained

**Time to detect**: 3m 0s  ·  **Cost**: 12345  ·  **Customers affected**: 7  ·  **Time to escalate**: 0s

**Run details**

- **Status**: Finished
- **Started**: November 14, 2023, 10:13 PM UTC
- **Ended**: November 15, 2023, 12:28 AM UTC
- **Owner**: Alice Admin
- **Participants**: Alice Admin, Bob Builder, Carol Chen
- **Severity**: Sev 2
- **Users affected**: Alfred Morrison (Marketing), Jane Smith (Sales)
- **Responders**: Bob Builder, Carol Chen
- **Detected**: November 14, 2023
- **Customer ticket**: Not set
- **Channel**: [Database outage (42)](https://chat.example.com/ops/channels/database-outage-42)
- **Playbook**: [Sev1 \*Incident\* Response](https://chat.example.com/playbooks/playbooks/pb1)

## Status updates

### Alice Admin · November 14, 2023, 10:18 PM UTC

Investigating. cc `@here`

### Bob Builder · November 14, 2023, 10:58 PM UTC

Mitigated; **monitoring**.

### Carol Chen · November 15, 2023, 12:13 AM UTC

_No message._

## Timeline

- **November 14, 2023, 10:13 PM UTC** · Run started by Alice Admin
- **November 14, 2023, 10:14 PM UTC** · alice added `@carol` to the run
- **November 14, 2023, 10:15 PM UTC** · Alice Admin set Severity to Sev 2
- **November 14, 2023, 10:23 PM UTC** · Alice Admin checked off checklist item "Page on-call"
- **November 14, 2023, 10:24 PM UTC** · Bob Builder skipped a checklist item
- **November 14, 2023, 10:33 PM UTC** · Assignee Changed
  Alice Admin changed assignee of checklist item **Notify stakeholders** from **No Assignee** to `@bob`
- **November 14, 2023, 10:58 PM UTC** · Bob Builder posted a status update
- **November 14, 2023, 11:13 PM UTC** · Owner changed from `@alice` to `@bob`
- **November 14, 2023, 11:43 PM UTC** · Timeline event
- **November 15, 2023, 12:28 AM UTC** · Run finished by Alice Admin

## Retrospective

## What went well
- Quick paging

**Metrics**

- **Time to detect**: 3m 0s
  Measured from
  alert to ack
- **Cost**: 12345
- **Customers affected**: 7
- **Time to resolve**: not set
- **Time to escalate**: 0s

## Task outline

### Initial response (2/4 · 50%)

- [x] Page on-call
  *(Assigned to Alice Admin · Checked off by Alice Admin on November 14, 2023, 10:23 PM UTC)*
- [-] Open war room
  *(Skipped on November 14, 2023, 10:24 PM UTC)*
- [ ] Notify **stakeholders**
  *(Assigned to Bob Builder · Due: November 14, 2023, 11:13 PM UTC)*
- [ ] Postmortem doc
  *(Unassigned · Due: November 16, 2023, 12:13 AM UTC · `/postmortem create`)*

    Write it up.
    Share with `@carol`.

### Checklist 2 (0/0 · 0%)

_No tasks._

### Wrap-up (1/1 · 100%)

- [x] Close incident
  *(Assigned to Carol Chen · Checked off by Bob Builder on November 15, 2023, 12:13 AM UTC)*

## Chat history

> **Alice Admin** · November 14, 2023, 10:15 PM UTC
> Looking into it. `@channel`
> ↳ **Bob Builder** · November 14, 2023, 10:19 PM UTC
>   Same here.
>
> **Carol Chen** · November 14, 2023, 10:17 PM UTC
> Dashboards are red:
> 
> ```
> error rate 40%
> ```

**Orphan replies**

_Parent message is outside this transcript._

> ↳ **Carol Chen** · November 14, 2023, 10:21 PM UTC
>   Following up on the earlier thread.

---

_Generated November 15, 2023, 1:13 AM UTC._
