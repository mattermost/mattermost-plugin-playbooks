# Database outage \#42

## Executive summary

Primary DB failed over. **Resolved** by `@alice`.

- Replica promoted
- Traffic drained

**Tasks**: 3/5 (60% complete)  ·  **Updates**: 3  ·  **Participants**: 3  ·  **Duration**: 3h 0m

**Status**: In Progress  ·  **Owner**: Alice Admin  ·  **Started**: November 14, 2023, 11:13 PM CET  ·  **Playbook**: Sev1 \*Incident\* Response

**Participants**: Alice Admin, Bob Builder, Carol Chen

## Status updates

### Alice Admin — November 14, 2023, 11:18 PM CET

Investigating. cc `@here`

### Bob Builder — November 14, 2023, 11:58 PM CET

Mitigated; **monitoring**.

### Carol Chen — November 15, 2023, 1:13 AM CET

_No message._

## Timeline

- **November 14, 2023, 11:13 PM CET** · _Run created_ — Alice Admin created this run
- **November 14, 2023, 11:23 PM CET** · _Task updated_ — Alice Admin checked task 'Page on-call'
- **November 14, 2023, 11:24 PM CET** · _Task updated_ — Bob Builder skipped a task
- **November 14, 2023, 11:58 PM CET** · _Status update posted_ — `@bob` posted a status update
  Mitigated; monitoring.
- **November 15, 2023, 12:13 AM CET** · _Owner changed_ — Bob Builder changed owner
- **November 15, 2023, 12:43 AM CET** · _Event_ — Timeline event
- **November 15, 2023, 1:28 AM CET** · _Run finished_ — Alice Admin marked this run finished

## Retrospective

## What went well
- Quick paging

**Metrics**

- **Time to detect** — 3m 0s
  Measured from
  alert to ack
- **Cost** — 12345
- **Customers affected** — 7
- **Time to resolve** — not set
- **Time to escalate** — 0s

## Task outline

### Initial response (2/4 · 50%)

- [x] Page on-call
  *(Alice Admin · Checked off by Alice Admin on November 14, 2023, 11:23 PM CET)*
- [-] Open war room
  *(Skipped on November 14, 2023, 11:24 PM CET)*
- [ ] Notify **stakeholders**
  *(Bob Builder · Due: November 15, 2023, 12:13 AM CET)*
- [ ] Postmortem doc
  *(Unassigned · Due: November 16, 2023, 1:13 AM CET · `/postmortem create`)*

    Write it up.
    Share with `@carol`.

### Checklist 2 (0/0 · 0%)

_No tasks._

### Wrap-up (1/1 · 100%)

- [x] Close incident
  *(Carol Chen · Checked off by Bob Builder on November 15, 2023, 1:13 AM CET)*

## Chat history

> **Alice Admin** — November 14, 2023, 11:15 PM CET
> Looking into it. `@channel`
>
> **Carol Chen** — November 14, 2023, 11:17 PM CET
> Dashboards are red:
> 
> ```
> error rate 40%
> ```
>
> ↳ **Bob Builder** — November 14, 2023, 11:19 PM CET  *(reply to Alice Admin)*
> Same here.
>
> ↳ **Carol Chen** — November 14, 2023, 11:21 PM CET  *(reply to message not in transcript)*
> Following up on the earlier thread.

---

_Generated November 15, 2023, 2:13 AM CET._
