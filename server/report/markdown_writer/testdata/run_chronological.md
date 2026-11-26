# Database outage \#42

## Executive summary

Primary DB failed over. **Resolved** by `@alice`.

- Replica promoted
- Traffic drained

**Time to detect**: 3m 0s  ·  **Cost**: 12345  ·  **Customers affected**: 7  ·  **Time to escalate**: 0s

**Run details**

- **Status**: In Progress
- **Started**: November 14, 2023, 11:13 PM CET
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

### Alice Admin · November 14, 2023, 11:18 PM CET

Investigating. cc `@here`

### Bob Builder · November 14, 2023, 11:58 PM CET

Mitigated; **monitoring**.

### Carol Chen · November 15, 2023, 1:13 AM CET

_No message._

## Timeline

- **November 14, 2023, 11:13 PM CET** · Run started by Alice Admin
- **November 14, 2023, 11:14 PM CET** · alice added `@carol` to the run
- **November 14, 2023, 11:15 PM CET** · Alice Admin set Severity to Sev 2
- **November 14, 2023, 11:23 PM CET** · Alice Admin checked off checklist item "Page on-call"
- **November 14, 2023, 11:24 PM CET** · Bob Builder skipped a checklist item
- **November 14, 2023, 11:33 PM CET** · Assignee Changed
  - Alice Admin changed assignee of checklist item **Notify stakeholders** from **No Assignee** to `@bob`
- **November 14, 2023, 11:58 PM CET** · Bob Builder posted a status update
- **November 15, 2023, 12:13 AM CET** · Owner changed from `@alice` to `@bob`
- **November 15, 2023, 12:43 AM CET** · Timeline event
- **November 15, 2023, 1:28 AM CET** · Run finished by Alice Admin

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
  *(Assigned to Alice Admin · Checked off by Alice Admin on November 14, 2023, 11:23 PM CET)*
- ~~Open war room~~
  *(Skipped on November 14, 2023, 11:24 PM CET)*
- [ ] Notify **stakeholders**
  *(Assigned to Bob Builder · Due: November 15, 2023, 12:13 AM CET)*
- [ ] Postmortem doc
  *(Unassigned · Due: November 16, 2023, 1:13 AM CET · `/postmortem create`)*

    Write it up.
    Share with `@carol`.

### Checklist 2 (0/0 · 0%)

_No tasks._

### Wrap-up (1/1 · 100%)

- [x] Close incident
  *(Assigned to Carol Chen · Checked off by Bob Builder on November 15, 2023, 1:13 AM CET)*

## Chat history

> **Alice Admin** · November 14, 2023, 11:15 PM CET
> Looking into it. `@channel`
>
> **Carol Chen** · November 14, 2023, 11:17 PM CET
> Dashboards are red:
> 
> ```
> error rate 40%
> ```
>
> ↳ **Bob Builder** · November 14, 2023, 11:19 PM CET  *(reply to Alice Admin)*
> Same here.
>
> ↳ **Carol Chen** · November 14, 2023, 11:21 PM CET  *(reply to message not in transcript)*
> Following up on the earlier thread.

---

_Generated November 15, 2023, 2:13 AM CET._
