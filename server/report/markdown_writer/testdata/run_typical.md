# Database outage \#42

**Status**: Finished  ·  **Owner**: `@alice`  ·  **Started**: 2023-11-14 22:13  ·  **Ended**: 2023-11-15 00:28  ·  **Playbook**: Sev1 \*Incident\* Response

**Tasks**: 3/5 (60% complete)  ·  **Updates**: 3  ·  **Participants**: 3  ·  **Duration**: 2h 15m

**Participants**: `@alice`, `@bob`, `@carol`

## Summary

Primary DB failed over. **Resolved** by `@alice`.

- Replica promoted
- Traffic drained

## Timeline

- **2023-11-14 22:13** · _Run created_ — `@alice` created this run
- **2023-11-14 22:23** · _Task updated_ — `@alice` checked task 'Page on-call'
- **2023-11-14 22:24** · _Task updated_ — `@bob` skipped a task
- **2023-11-14 22:58** · _Status update posted_ — `@bob` posted a status update
  Mitigated; monitoring.
- **2023-11-14 23:13** · _Owner changed_ — `@bob` changed owner
- **2023-11-14 23:43** · _Event_ — Timeline event
- **2023-11-15 00:28** · _Run finished_ — `@alice` marked this run finished

## Status Updates

### `@alice` — 2023-11-14 22:18

Investigating. cc `@here`

### `@bob` — 2023-11-14 22:58

Mitigated; **monitoring**.

### `@carol` — 2023-11-15 00:13

_No message._

## Tasks

### Initial response (2/4 · 50%)

- [x] Page on-call
  *(`@alice`)*
- [-] Open war room
- [ ] Notify **stakeholders**
  *(`@bob` · Due: 2023-11-14 23:13)*
- [ ] Postmortem doc
  *(Unassigned · Due: 2023-11-16 00:13 · `/postmortem create`)*

    Write it up.
    Share with `@carol`.

### Checklist 2 (0/0 · 0%)

_No tasks._

### Wrap-up (1/1 · 100%)

- [x] Close incident
  *(`@carol`)*

## Retrospective

## What went well
- Quick paging

**Metrics**

- **Time to detect** — 3m 0s
  Measured from
  alert to ack
- **Cost** — 123.45
- **Customers affected** — 7
- **Time to resolve** — not set
- **Time to escalate** — 0s

## Transcript

> **`@alice`** — 2023-11-14 22:15
> Looking into it. `@channel`
> ↳ **`@bob`** — 2023-11-14 22:19
>   Same here.
>
> **`@carol`** — 2023-11-14 22:17
> Dashboards are red:
> 
> ```
> error rate 40%
> ```

**Orphan replies**

_Parent message is outside this transcript._

> ↳ **`@carol`** — 2023-11-14 22:21
>   Following up on the earlier thread.

---

_Generated 2023-11-15 01:13 UTC._
