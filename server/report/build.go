// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"cmp"
	"fmt"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

// builder carries what every part of a report is built with.
type builder struct {
	T          i18n.TranslateFunc
	loc        *time.Location
	nameFormat string
	users      map[string]RenderUser
}

func newBuilder(users map[string]RenderUser, opts Options) *builder {
	return &builder{T: opts.T, loc: cmp.Or(opts.Location, time.UTC), nameFormat: opts.NameFormat, users: users}
}

// lang turns a Mattermost locale such as "pt-BR" or "zh_Hans" into a BCP 47
// tag.
func lang(locale string) string {
	return strings.ReplaceAll(cmp.Or(locale, "en"), "_", "-")
}

// BuildRun turns rc into a translated, display-ready run report.
func BuildRun(rc RenderContext, opts Options) *RunReport {
	b := newBuilder(rc.Users, opts)
	T := b.T

	r := &RunReport{
		Lang:      lang(opts.Locale),
		Title:     cmp.Or(strings.TrimSpace(rc.Run.Name), T("app.report.run.untitled")),
		Kind:      T("app.report.run.kind"),
		Generated: b.date(rc.GeneratedAtMillis),
		Footer:    b.footer(rc.GeneratedAtMillis),
	}

	switch rc.Run.Status {
	case "":
	case RunStatusInProgress:
		r.Status, r.StatusKind = Field{Label: T("app.report.run.status"), Value: T("app.report.run.status.in_progress")}, StatusInProgress
	case RunStatusFinished:
		r.Status, r.StatusKind = Field{Label: T("app.report.run.status"), Value: T("app.report.run.status.finished")}, StatusFinished
	default:
		r.Status, r.StatusKind = Field{Label: T("app.report.run.status"), Value: rc.Run.Status}, StatusOther
	}

	done, total := 0, 0
	for _, cl := range rc.Checklists {
		d, t := countDone(cl.Items)
		done += d
		total += t
	}
	tasks := Stat{Label: T("app.report.run.stat.tasks"), Value: fmt.Sprintf("%d/%d", done, total)}
	if total > 0 {
		tasks.Hint = T("app.report.run.stat.tasks_complete", map[string]any{"Percent": done * 100 / total})
	}
	r.Stats = b.metricStats(rc.Retrospective)
	if len(r.Stats) == 0 {
		r.Stats = []Stat{
			tasks,
			{Label: T("app.report.run.stat.updates"), Value: strconv.Itoa(len(rc.StatusUpdates))},
			{Label: T("app.report.run.stat.participants"), Value: strconv.Itoa(len(rc.Participants))},
			{Label: T("app.report.run.stat.duration"), Value: cmp.Or(b.runDuration(rc), "-")},
		}
	}

	participants := make([]string, 0, len(rc.Participants))
	for _, u := range rc.Participants {
		participants = append(participants, b.inlineUserName(u))
	}
	r.DetailsTitle = T("app.report.run.details.title")
	details := []Field{
		{Label: T("app.report.run.started"), Value: b.date(rc.Run.StartTimeMs)},
		{Label: T("app.report.run.ended"), Value: b.date(rc.Run.EndTimeMs)},
		{Label: T("app.report.run.owner"), Value: b.inlineUserName(rc.Owner)},
		{Label: T("app.report.run.participants"), Value: strings.Join(participants, ", ")},
	}
	for _, a := range rc.Attributes {
		details = append(details, Field{Label: a.Name, Value: b.attributeValue(a)})
	}
	details = append(details,
		Field{Label: T("app.report.run.channel"), Value: rc.Run.ChannelName, URL: rc.Run.ChannelURL},
		Field{Label: T("app.report.run.playbook"), Value: rc.Run.PlaybookTitle, URL: rc.Run.PlaybookURL},
	)
	for _, f := range details {
		if f.Value != "" {
			r.Details = append(r.Details, f)
		}
	}

	r.Summary = BodySection{
		Section: Section{Title: T("app.report.run.summary.title"), Empty: T("app.report.run.summary.empty")},
		Body:    trimBody(rc.Run.Summary),
	}

	r.Timeline.Section = Section{Title: T("app.report.run.timeline.title"), Empty: T("app.report.run.timeline.empty")}
	for _, ev := range rc.TimelineEvents {
		r.Timeline.Events = append(r.Timeline.Events, b.timelineEvent(ev))
	}

	r.StatusUpdates = StatusUpdateSection{
		Section:   Section{Title: T("app.report.run.status_updates.title"), Empty: T("app.report.run.status_updates.empty")},
		NoMessage: T("app.report.run.status_updates.no_message"),
	}
	for _, su := range rc.StatusUpdates {
		r.StatusUpdates.Updates = append(r.StatusUpdates.Updates, b.post(su.AuthorID, su.CreateAt, su.Message))
	}

	r.Tasks.Section = Section{Title: T("app.report.run.tasks.title"), Empty: T("app.report.run.tasks.empty")}
	for i, cl := range rc.Checklists {
		r.Tasks.Checklists = append(r.Tasks.Checklists, b.checklist(cl, i))
	}

	r.Retrospective = b.retrospective(rc.Retrospective)

	r.Transcript = b.transcript(rc, opts.TranscriptMode)

	r.Timeline.Omitted = !rc.Sections.Timeline
	r.Tasks.Omitted = !rc.Sections.Checklists
	r.Retrospective.Omitted = !rc.Sections.Retrospective
	r.Transcript.Omitted = !rc.Sections.Transcript
	return r
}

// maxMetricStats is how many metrics the headline figures show at most.
const maxMetricStats = 4

// metricStats shows a published retrospective's measured metrics as the
// headline figures; it is empty for a draft or canceled one, or when no
// metric has a value.
func (b *builder) metricStats(retro RenderRetrospective) []Stat {
	if !retro.Published {
		return nil
	}
	var stats []Stat
	for _, m := range retro.Metrics {
		if m.HasValue && len(stats) < maxMetricStats {
			stats = append(stats, Stat{Label: m.Title, Value: b.metricValue(m.Type, m.Value)})
		}
	}
	return stats
}

// attributeValue shows an attribute's text, users and date, or that it is
// not set.
func (b *builder) attributeValue(a RenderAttribute) string {
	parts := slices.Clone(a.Text)
	for _, id := range a.UserIDs {
		parts = append(parts, b.userName(id))
	}
	if day := b.day(a.DateMs); day != "" {
		parts = append(parts, day)
	}
	if len(parts) == 0 {
		return b.T("app.report.attribute.not_set")
	}
	return strings.Join(parts, ", ")
}

// retrospective shows a published retrospective as it is, a draft with a
// note saying so, and a canceled one only as a note saying who canceled it
// and when.
func (b *builder) retrospective(retro RenderRetrospective) RetrospectiveSection {
	T := b.T
	s := RetrospectiveSection{
		Section:      Section{Title: T("app.report.run.retrospective.title"), Empty: T("app.report.run.retrospective.empty")},
		MetricsTitle: T("app.report.metrics.title"),
	}
	if retro.Canceled {
		args := map[string]any{"Date": b.date(retro.CanceledAt)}
		switch {
		case args["Date"] == "":
			s.Note = T("app.report.run.retrospective.canceled")
		case retro.CanceledByID != "":
			args["User"] = b.userName(retro.CanceledByID)
			s.Note = T("app.report.run.retrospective.canceled_by", args)
		default:
			s.Note = T("app.report.run.retrospective.canceled_on", args)
		}
		return s
	}
	s.Body = trimBody(retro.Body)
	for _, m := range retro.Metrics {
		value := T("app.report.metric.not_set")
		if m.HasValue {
			value = b.metricValue(m.Type, m.Value)
		}
		s.Metrics = append(s.Metrics, Metric{
			Title:       m.Title,
			Value:       value,
			Description: trimBody(m.Description),
		})
	}
	// An empty draft just has no retrospective yet.
	if !retro.Published && (s.Body != "" || len(s.Metrics) > 0) {
		s.Note = T("app.report.run.retrospective.draft")
	}
	return s
}

func (b *builder) checklist(cl RenderChecklist, index int) Checklist {
	T := b.T
	done, total := countDone(cl.Items)
	out := Checklist{
		Title: cmp.Or(strings.TrimSpace(cl.Title), T("app.report.checklist.untitled", map[string]any{"Number": index + 1})),
	}
	pct := 0
	if total > 0 {
		pct = done * 100 / total
	}
	out.Progress = T("app.report.checklist.progress", map[string]any{"Done": done, "Total": total, "Percent": pct})
	if total == 0 {
		out.Empty = T("app.report.checklist.empty")
	}

	for _, it := range cl.Items {
		item := ChecklistItem{
			Done:        it.State == ChecklistItemStateClosed,
			Skipped:     it.State == ChecklistItemStateSkipped,
			Title:       it.Title,
			Command:     it.Command,
			Description: trimBody(it.Description),
		}
		if it.DueAtMs > 0 {
			item.Due = T("app.report.checklist.due", map[string]any{"Date": b.date(it.DueAtMs)})
		}
		if it.AssigneeID != "" {
			item.Assignee = T("app.report.checklist.assigned_to", map[string]any{"User": b.userName(it.AssigneeID)})
		} else if item.Due != "" || item.Command != "" {
			item.Assignee = T("app.report.checklist.unassigned")
		}
		item.Completed = b.completed(it)
		out.Items = append(out.Items, item)
	}
	return out
}

// completed says who closed or skipped a task and when.
func (b *builder) completed(it RenderChecklistItem) string {
	date := b.date(it.StateMs)
	if date == "" {
		return ""
	}
	args := map[string]any{"Date": date}
	if it.StateUserID != "" {
		args["User"] = b.userName(it.StateUserID)
	}
	switch {
	case it.State == ChecklistItemStateClosed && it.StateUserID != "":
		return b.T("app.report.checklist.checked_off_by", args)
	case it.State == ChecklistItemStateClosed:
		return b.T("app.report.checklist.checked_off", args)
	case it.State == ChecklistItemStateSkipped && it.StateUserID != "":
		return b.T("app.report.checklist.skipped_by", args)
	case it.State == ChecklistItemStateSkipped:
		return b.T("app.report.checklist.skipped", args)
	default:
		return ""
	}
}

// countDone returns (done, total) for a checklist; done counts closed and
// skipped tasks.
func countDone(items []RenderChecklistItem) (int, int) {
	done := 0
	for _, it := range items {
		if it.State == ChecklistItemStateClosed || it.State == ChecklistItemStateSkipped {
			done++
		}
	}
	return done, len(items)
}

func (b *builder) transcript(rc RenderContext, mode TranscriptMode) TranscriptSection {
	T := b.T
	s := TranscriptSection{
		Section:       Section{Title: T("app.report.run.transcript.title")},
		Chronological: mode == TranscriptModeChronological,
	}

	posts := rc.Transcript
	switch {
	case len(rc.Transcript) == 0 && rc.TranscriptOmittedReason == TranscriptOmittedNotMember:
		s.Empty = T("app.report.run.transcript.not_member")
	case len(rc.Transcript) == 0 && rc.TranscriptOmittedReason == TranscriptOmittedNoChannel:
		s.Empty = T("app.report.run.transcript.no_channel")
	default:
		// Either the section was not requested or the channel had no posts
		// in the run's window; "No transcript." is honest in both cases.
		s.Empty = T("app.report.run.transcript.empty")
	}

	if s.Chronological {
		sort.SliceStable(posts, func(i, j int) bool { return posts[i].CreateAt < posts[j].CreateAt })
		authors := make(map[string]string, len(posts))
		for _, p := range posts {
			authors[p.PostID] = b.userName(p.AuthorID)
		}
		for _, p := range posts {
			post := b.post(p.AuthorID, p.CreateAt, p.Message)
			if p.RootID != "" {
				post.IsReply = true
				post.ParentLabel = T("app.report.run.transcript.reply_to_missing")
				if author, ok := authors[p.RootID]; ok {
					post.ParentLabel = T("app.report.run.transcript.reply_to", map[string]any{"Author": author})
				}
			}
			s.Posts = append(s.Posts, post)
		}
	} else {
		threads, orphans := CollateThreads(posts)
		for _, thread := range threads {
			t := Thread{Post: b.post(thread[0].AuthorID, thread[0].CreateAt, thread[0].Message)}
			for _, reply := range thread[1:] {
				t.Replies = append(t.Replies, b.post(reply.AuthorID, reply.CreateAt, reply.Message))
			}
			s.Threads = append(s.Threads, t)
		}
		for _, p := range orphans {
			s.Orphans = append(s.Orphans, b.post(p.AuthorID, p.CreateAt, p.Message))
		}
		s.OrphansTitle = T("app.report.run.transcript.orphans_title")
		s.OrphansNote = T("app.report.run.transcript.orphans_note")
	}

	if rc.TranscriptTruncation.Hit {
		count := len(posts)
		s.Truncated = T("app.report.run.transcript.truncated", count, map[string]any{"Count": count})
	}
	return s
}

func (b *builder) post(authorID string, createAt int64, message string) Post {
	return Post{Author: b.userName(authorID), Date: b.date(createAt), Body: trimBody(message)}
}

// trimBody drops a Markdown body's leading blank lines and trailing
// whitespace. Leading spaces on the first line stay, since they can start
// an indented code block.
func trimBody(s string) string {
	if strings.TrimSpace(s) == "" {
		return ""
	}
	s = strings.TrimRightFunc(s, unicode.IsSpace)
	if i := strings.LastIndexByte(s[:len(s)-len(strings.TrimLeftFunc(s, unicode.IsSpace))], '\n'); i >= 0 {
		s = s[i+1:]
	}
	return s
}

// userName shows one of the report's users as the server's name
// format says, or as an unknown user when the requester cannot see them.
func (b *builder) userName(id string) string {
	if u, ok := b.users[id]; ok && id != "" {
		if name := b.displayName(u); name != "" {
			return name
		}
	}
	return b.T("app.report.unknown_user")
}

// inlineUserName shows a user the caller already resolved, falling back to
// the report's users.
func (b *builder) inlineUserName(u RenderUser) string {
	if name := b.displayName(u); name != "" {
		return name
	}
	return b.userName(u.UserID)
}

// displayName picks a user's name the way Mattermost does for the server's
// teammate name display setting, falling back to whichever name is set.
func (b *builder) displayName(u RenderUser) string {
	var name string
	switch b.nameFormat {
	case model.ShowNicknameFullName:
		name = cmp.Or(u.Nickname, u.DisplayName)
	case model.ShowFullName:
		name = u.DisplayName
	default:
		name = u.Username
	}
	return cmp.Or(name, u.Username, u.DisplayName)
}

// date shows a time in full, such as "November 14, 2023, 10:13 PM UTC", in
// the report's time zone.
func (b *builder) date(ms int64) string {
	if ms <= 0 {
		return ""
	}
	t := time.UnixMilli(ms).In(b.loc)
	return b.T("app.report.date", map[string]any{
		"Month":  b.month(t.Month()),
		"Day":    t.Day(),
		"Year":   t.Year(),
		"Hour12": t.Format("3"),
		"Hour24": t.Format("15"),
		"Minute": t.Format("04"),
		"Period": t.Format("PM"),
		"Zone":   t.Format("MST"),
	})
}

// day shows the date of ms, without a time. A date picked without a time
// is stored as midnight UTC, so it is shown in UTC to keep its day.
func (b *builder) day(ms int64) string {
	if ms <= 0 {
		return ""
	}
	t := time.UnixMilli(ms).In(b.loc)
	if utc := t.UTC(); utc.Hour() == 0 && utc.Minute() == 0 && utc.Second() == 0 {
		t = utc
	}
	return b.T("app.report.date_only", map[string]any{
		"Month": b.month(t.Month()),
		"Day":   t.Day(),
		"Year":  t.Year(),
	})
}

func (b *builder) month(m time.Month) string {
	switch m {
	case time.January:
		return b.T("app.report.month.january")
	case time.February:
		return b.T("app.report.month.february")
	case time.March:
		return b.T("app.report.month.march")
	case time.April:
		return b.T("app.report.month.april")
	case time.May:
		return b.T("app.report.month.may")
	case time.June:
		return b.T("app.report.month.june")
	case time.July:
		return b.T("app.report.month.july")
	case time.August:
		return b.T("app.report.month.august")
	case time.September:
		return b.T("app.report.month.september")
	case time.October:
		return b.T("app.report.month.october")
	case time.November:
		return b.T("app.report.month.november")
	default:
		return b.T("app.report.month.december")
	}
}

func (b *builder) footer(generatedAtMs int64) string {
	if generatedAtMs <= 0 {
		return ""
	}
	return b.T("app.report.footer.generated", map[string]any{"Time": b.date(generatedAtMs)})
}

// runDuration is how long the run lasted, or has lasted when the report was
// generated if it is still in progress.
func (b *builder) runDuration(rc RenderContext) string {
	start, end := rc.Run.StartTimeMs, rc.Run.EndTimeMs
	if end <= 0 {
		end = rc.GeneratedAtMillis
	}
	if start <= 0 || end <= start {
		return ""
	}
	return b.duration(end - start)
}

// duration shows a duration in its two largest units, such as "2h 15m".
func (b *builder) duration(ms int64) string {
	d := time.Duration(max(ms, 0)) * time.Millisecond
	args := map[string]any{
		"Days":    int64(d / (24 * time.Hour)),
		"Hours":   int64(d/time.Hour) % 24,
		"Minutes": int64(d/time.Minute) % 60,
		"Seconds": int64(d/time.Second) % 60,
	}
	switch {
	case d >= 24*time.Hour:
		return b.T("app.report.duration.days_hours", args)
	case d >= time.Hour:
		return b.T("app.report.duration.hours_minutes", args)
	case d >= time.Minute:
		return b.T("app.report.duration.minutes_seconds", args)
	default:
		return b.T("app.report.duration.seconds", args)
	}
}

// metricValue shows a metric's value. Durations are stored in milliseconds;
// currency, like integers, is stored and shown as the whole number the user
// entered.
func (b *builder) metricValue(metricType string, v int64) string {
	if metricType == "duration" {
		return b.duration(v)
	}
	return strconv.FormatInt(v, 10)
}
