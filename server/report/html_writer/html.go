// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html_writer

import (
	"bytes"
	_ "embed"
	"fmt"
	"html/template"
	"sort"
	"strings"
	"time"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
)

//go:embed templates/run_report.html.tmpl
var runReportTmpl string

//go:embed templates/playbook_report.html.tmpl
var playbookReportTmpl string

//go:embed templates/_styles.html.tmpl
var stylesTmpl string

// Options controls per-document presentation knobs that are independent of
// the report content.
type Options struct {
	// Title is the document <title>. Empty falls back to a sensible default
	// derived from the run or playbook name.
	Title string

	// PageSize controls the @page CSS size. "A4" and "Letter" are
	// recognized; any other value passes through verbatim. Empty defaults
	// to "Letter".
	PageSize string
}

// runReportData is the template data struct for the run report.
type runReportData struct {
	Title     string
	PageSize  string
	FontCSS   template.CSS
	StylesCSS template.CSS

	Run            report.RenderRun
	Owner          report.RenderUser
	Participants   []report.RenderUser
	StatusUpdates  []statusUpdateData
	TimelineEvents []timelineEventData
	Checklists     []checklistData
	Retrospective  retroData
	Transcript               []threadData
	TranscriptOrphans        []replyData // populated in threaded mode when parent posts are missing
	TranscriptChronological  bool        // true → render TranscriptChronoPosts instead of Transcript
	TranscriptChronoPosts    []chronoPost
	// TranscriptEmptyMessage is shown when the transcript section produces
	// no rendered posts. Set per the data-layer's TranscriptOmittedReason
	// so we don't blame channel membership when the real cause is "no
	// posts" or "section not requested".
	TranscriptEmptyMessage string

	TranscriptTruncation report.Truncation

	// Computed
	OwnerDisplay   string
	StartedAt      string
	EndedAt        string
	Duration       string
	SummaryHTML    template.HTML
	TasksDone      int
	TasksTotal     int
	TasksPct       int
	IsInProgress   bool
	IsFinished     bool

	GeneratedAt string
	Resolvers   report.ResolverTable
}

type statusUpdateData struct {
	AuthorDisplay string
	FormattedDate string
	Body          template.HTML
}

type timelineEventData struct {
	FormattedDate string
	TypeLabel     string
	Category      string        // CSS class hook
	HeadlineHTML  template.HTML // through markdownInlineToHTML
	DetailHTML    template.HTML // through markdownInlineToHTML, empty if no detail
}

type checklistData struct {
	Title string
	Done  int
	Total int
	Pct   int
	Items []checklistItemData
}

type checklistItemData struct {
	State           string // raw value; templates should prefer IsClosed/IsSkipped
	IsClosed        bool
	IsSkipped       bool
	TitleHTML       template.HTML
	AssigneeDisplay string
	DueDateStr      string
	DescHTML        template.HTML
	Command         string
}

type retroData struct {
	BodyHTML template.HTML
	Metrics  []metricData
}

type metricData struct {
	Title       string
	Description string
	ValueStr    string
	TypeStr     string
	TargetStr   string
}

type threadData struct {
	AuthorDisplay string
	FormattedDate string
	BodyHTML      template.HTML
	Replies       []replyData
}

type replyData struct {
	AuthorDisplay string
	FormattedDate string
	BodyHTML      template.HTML
	// ParentLabel is populated only in chronological mode (e.g.,
	// "reply to @alice" or "reply to message not in transcript"). Empty
	// in threaded mode because the visual nesting already conveys parent.
	ParentLabel string
}

// chronoPost is a flat-stream representation of a transcript post used by
// the chronological transcript mode. IsReply switches the template to the
// ↳-prefixed reply chrome with a ParentLabel sentinel.
type chronoPost struct {
	AuthorDisplay string
	FormattedDate string
	BodyHTML      template.HTML
	IsReply       bool
	ParentLabel   string
}

// playbookReportData is the template data struct for the playbook report.
type playbookReportData struct {
	Title     string
	PageSize  string
	FontCSS   template.CSS
	StylesCSS template.CSS

	Playbook            report.RenderPlaybook
	Members             []playbookMemberData
	Checklists          []checklistData
	StatusUpdateConfig  statusUpdateCfgData
	RetrospectiveConfig retroCfgData
	BroadcastChannels   []report.RenderChannel
	WebhooksOnCreation  []string
	WebhooksOnStatus    []string
	SignalKeywords      []string

	// Computed
	DescriptionHTML template.HTML
	WebhookCount    int
	HasAutomations  bool

	GeneratedAt string
}

type playbookMemberData struct {
	Display  string
	RolesStr string
}

type statusUpdateCfgData struct {
	Configured   bool
	EnabledLabel string
	Cadence      string
	TemplateHTML template.HTML
}

type retroCfgData struct {
	Configured   bool
	EnabledLabel string
	Cadence      string
	TemplateHTML template.HTML
	Metrics      []metricData
}

// redactedUser is the deny sentinel for an unresolvable user — matches the
// markdown_writer package convention.
const redactedUser = "@_redacted_user_"

// RenderRunHTML renders rc to a complete self-contained HTML document.
//
// The output embeds a strict Content-Security-Policy that forbids all
// scripts and disallows network fetches; styles are limited to the
// document's own <style> tags. The same document is served verbatim from
// the report.html endpoint and is the input to the Gotenberg PDF adapter.
func RenderRunHTML(rc report.RenderContext, opts Options) ([]byte, error) {
	data := buildRunData(rc, opts)

	tmpl, err := parseTemplates("run_report", runReportTmpl)
	if err != nil {
		return nil, fmt.Errorf("html_writer: parse run template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, fmt.Errorf("html_writer: execute run template: %w", err)
	}
	return buf.Bytes(), nil
}

// RenderPlaybookHTML renders pc to a complete self-contained HTML document.
// See RenderRunHTML for shared output guarantees.
func RenderPlaybookHTML(pc report.PlaybookRenderContext, opts Options) ([]byte, error) {
	data := buildPlaybookData(pc, opts)

	tmpl, err := parseTemplates("playbook_report", playbookReportTmpl)
	if err != nil {
		return nil, fmt.Errorf("html_writer: parse playbook template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, fmt.Errorf("html_writer: execute playbook template: %w", err)
	}
	return buf.Bytes(), nil
}

// parseTemplates parses the main template plus the shared _styles partial.
func parseTemplates(name, body string) (*template.Template, error) {
	t := template.New(name)
	if _, err := t.Parse(stylesTmpl); err != nil {
		return nil, err
	}
	if _, err := t.Parse(body); err != nil {
		return nil, err
	}
	return t, nil
}

// pageSize normalizes the @page size hint.
func pageSize(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "a4":
		return "A4"
	case "letter", "":
		return "Letter"
	default:
		return s
	}
}

// ---------- run report data builder ----------

func buildRunData(rc report.RenderContext, opts Options) runReportData {
	title := opts.Title
	if title == "" {
		title = rc.Run.Name
	}
	if title == "" {
		title = "Playbook Run Report"
	}

	tasksDone, tasksTotal := countTasksAcross(rc.Checklists)
	tasksPct := 0
	if tasksTotal > 0 {
		tasksPct = (tasksDone * 100) / tasksTotal
	}

	data := runReportData{
		Title:                title,
		PageSize:             pageSize(opts.PageSize),
		FontCSS:              template.CSS(systemFontCSS()),
		Run:                  rc.Run,
		Owner:                rc.Owner,
		Participants:         rc.Participants,
		TranscriptTruncation: rc.TranscriptTruncation,
		Resolvers:            rc.Resolvers,
		OwnerDisplay:         resolveOwnerDisplay(rc.Owner, rc.Resolvers),
		StartedAt:            formatDate(rc.Run.StartTimeMs),
		EndedAt:              formatDate(rc.Run.EndTimeMs),
		Duration:             computeDuration(rc.Run),
		SummaryHTML:          markdownToHTML(rc.Run.Summary, rc.Resolvers),
		TasksDone:            tasksDone,
		TasksTotal:           tasksTotal,
		TasksPct:             tasksPct,
		IsInProgress:         rc.Run.Status == coretypes.RunStatusInProgress,
		IsFinished:           rc.Run.Status == coretypes.RunStatusFinished,
		GeneratedAt:          formatDate(rc.GeneratedAtMillis),
	}

	// Status updates.
	for _, su := range rc.StatusUpdates {
		data.StatusUpdates = append(data.StatusUpdates, statusUpdateData{
			AuthorDisplay: resolveUserDisplay(rc.Resolvers, su.AuthorID),
			FormattedDate: formatDate(su.CreateAt),
			Body:          markdownToHTML(su.Message, rc.Resolvers),
		})
	}

	// Timeline.
	for _, ev := range rc.TimelineEvents {
		f := report.FormatTimelineEvent(ev, rc.Resolvers)
		td := timelineEventData{
			FormattedDate: formatDate(ev.CreateAt),
			TypeLabel:     f.TypeLabel,
			Category:      string(f.Category),
			HeadlineHTML:  markdownInlineToHTML(f.Headline, rc.Resolvers),
		}
		if f.Detail != "" {
			td.DetailHTML = markdownInlineToHTML(f.Detail, rc.Resolvers)
		}
		data.TimelineEvents = append(data.TimelineEvents, td)
	}

	// Checklists.
	for i, cl := range rc.Checklists {
		data.Checklists = append(data.Checklists, buildChecklistData(cl, rc.Resolvers, i, false))
	}

	// Retrospective.
	data.Retrospective = retroData{
		BodyHTML: markdownToHTML(rc.Retrospective.Body, rc.Resolvers),
	}
	for _, m := range rc.Retrospective.Metrics {
		data.Retrospective.Metrics = append(data.Retrospective.Metrics, metricData{
			Title:       m.Title,
			Description: m.Description,
			ValueStr:    formatMetricValue(m),
		})
	}

	// Transcript.
	if len(rc.Transcript) == 0 {
		data.TranscriptEmptyMessage = transcriptEmptyMessage(rc.TranscriptOmittedReason)
	} else {
		filtered := filterSystemPosts(rc.Transcript)
		if rc.TranscriptMode == coretypes.TranscriptModeChronological {
			data.TranscriptChronological = true
			data.TranscriptChronoPosts = buildChronologicalPosts(filtered, rc.Resolvers)
		} else {
			data.Transcript, data.TranscriptOrphans = buildThreadedTranscript(filtered, rc.Resolvers)
		}
	}

	return data
}

// buildThreadedTranscript turns a flat post slice into threadData/replyData
// shapes for the template. Threading semantics live in report.CollateThreads
// (single source of truth, shared with markdown_writer): grouping is by
// RootID; CreateAt is used only for display order; orphans return in a
// separate slice rendered under their own subsection.
func buildThreadedTranscript(posts []report.RenderPost, rt report.ResolverTable) ([]threadData, []replyData) {
	threads, orphans := report.CollateThreads(posts)
	out := make([]threadData, 0, len(threads))
	for _, t := range threads {
		root := t[0]
		td := threadData{
			AuthorDisplay: resolveUserDisplay(rt, root.AuthorID),
			FormattedDate: formatDate(root.CreateAt),
			BodyHTML:      markdownToHTML(root.Message, rt),
		}
		for _, reply := range t[1:] {
			td.Replies = append(td.Replies, replyData{
				AuthorDisplay: resolveUserDisplay(rt, reply.AuthorID),
				FormattedDate: formatDate(reply.CreateAt),
				BodyHTML:      markdownToHTML(reply.Message, rt),
			})
		}
		out = append(out, td)
	}
	orphanRD := make([]replyData, 0, len(orphans))
	for _, p := range orphans {
		orphanRD = append(orphanRD, replyData{
			AuthorDisplay: resolveUserDisplay(rt, p.AuthorID),
			FormattedDate: formatDate(p.CreateAt),
			BodyHTML:      markdownToHTML(p.Message, rt),
		})
	}
	return out, orphanRD
}

// buildChronologicalPosts emits posts in strict CreateAt order. Reply posts
// carry a ParentLabel; orphans get the "not in transcript" sentinel.
func buildChronologicalPosts(posts []report.RenderPost, rt report.ResolverTable) []chronoPost {
	ordered := make([]report.RenderPost, len(posts))
	copy(ordered, posts)
	sort.SliceStable(ordered, func(i, j int) bool {
		return ordered[i].CreateAt < ordered[j].CreateAt
	})
	authorOf := make(map[string]string, len(ordered))
	for _, p := range ordered {
		authorOf[p.PostID] = resolveUserDisplay(rt, p.AuthorID)
	}
	out := make([]chronoPost, 0, len(ordered))
	for _, p := range ordered {
		cp := chronoPost{
			AuthorDisplay: resolveUserDisplay(rt, p.AuthorID),
			FormattedDate: formatDate(p.CreateAt),
			BodyHTML:      markdownToHTML(p.Message, rt),
			IsReply:       p.RootID != "",
		}
		if cp.IsReply {
			if name := authorOf[p.RootID]; name != "" {
				cp.ParentLabel = "reply to " + name
			} else {
				cp.ParentLabel = "reply to message not in transcript"
			}
		}
		out = append(out, cp)
	}
	return out
}

// ---------- playbook report data builder ----------

func buildPlaybookData(pc report.PlaybookRenderContext, opts Options) playbookReportData {
	title := opts.Title
	if title == "" {
		title = pc.Playbook.Title
	}
	if title == "" {
		title = "Playbook Report"
	}

	data := playbookReportData{
		Title:             title,
		PageSize:          pageSize(opts.PageSize),
		FontCSS:           template.CSS(systemFontCSS()),
		Playbook:          pc.Playbook,
		BroadcastChannels: pc.BroadcastChannels,
		SignalKeywords:    pc.SignalKeywords,
		DescriptionHTML:   markdownToHTML(pc.Playbook.Description, pc.Resolvers),
		GeneratedAt:       formatDate(pc.GeneratedAtMillis),
	}

	for _, m := range pc.Members {
		display := m.DisplayName
		if u, ok := pc.Resolvers.Users[m.UserID]; ok && u.Username != "" {
			display = "@" + u.Username
		} else if display == "" {
			display = redactedUser
		}
		data.Members = append(data.Members, playbookMemberData{
			Display:  display,
			RolesStr: strings.Join(m.Roles, ", "),
		})
	}

	for i, cl := range pc.ChecklistTemplates {
		data.Checklists = append(data.Checklists, buildChecklistData(cl, pc.Resolvers, i, true))
	}

	// Status update config.
	suCfg := pc.StatusUpdateConfig
	tmplStr := strings.TrimSpace(suCfg.Template)
	data.StatusUpdateConfig = statusUpdateCfgData{
		Configured:   suCfg.Enabled || tmplStr != "" || suCfg.Cadence != "",
		EnabledLabel: enabledLabel(suCfg.Enabled),
		Cadence:      suCfg.Cadence,
		TemplateHTML: markdownToHTML(tmplStr, pc.Resolvers),
	}

	// Retrospective config.
	rCfg := pc.RetrospectiveConfig
	rTmpl := strings.TrimSpace(rCfg.Template)
	retro := retroCfgData{
		Configured:   rCfg.Enabled || rTmpl != "" || rCfg.ReminderCadence != "" || len(rCfg.Metrics) > 0,
		EnabledLabel: enabledLabel(rCfg.Enabled),
		Cadence:      rCfg.ReminderCadence,
		TemplateHTML: markdownToHTML(rTmpl, pc.Resolvers),
	}
	for _, m := range rCfg.Metrics {
		retro.Metrics = append(retro.Metrics, metricData{
			Title:       m.Title,
			Description: m.Description,
			TypeStr:     m.Type,
			TargetStr:   formatMetricTarget(m),
		})
	}
	data.RetrospectiveConfig = retro

	// Webhooks (flatten to display strings preserving the Full > HostMasked
	// preference set by ReportService).
	for _, h := range pc.WebhooksOnCreation {
		if v := pickWebhookValue(h); v != "" {
			data.WebhooksOnCreation = append(data.WebhooksOnCreation, v)
		}
	}
	for _, h := range pc.WebhooksOnStatus {
		if v := pickWebhookValue(h); v != "" {
			data.WebhooksOnStatus = append(data.WebhooksOnStatus, v)
		}
	}
	data.WebhookCount = len(data.WebhooksOnCreation) + len(data.WebhooksOnStatus)

	data.HasAutomations = len(data.BroadcastChannels) > 0 ||
		len(data.WebhooksOnCreation) > 0 ||
		len(data.WebhooksOnStatus) > 0 ||
		len(data.SignalKeywords) > 0

	return data
}

func pickWebhookValue(h report.RenderWebhook) string {
	if h.Full != "" {
		return h.Full
	}
	return h.HostMasked
}

// ---------- shared helpers ----------

func buildChecklistData(cl report.RenderChecklist, rt report.ResolverTable, index int, isTemplate bool) checklistData {
	title := cl.Title
	if title == "" {
		title = fmt.Sprintf("Checklist %d", index+1)
	}

	done, total := countClosed(cl.Items)
	pct := 0
	if total > 0 {
		pct = (done * 100) / total
	}
	out := checklistData{
		Title: title,
		Done:  done,
		Total: total,
		Pct:   pct,
	}
	for _, it := range cl.Items {
		item := checklistItemData{
			State:     it.State,
			IsClosed:  it.State == coretypes.ChecklistItemStateClosed,
			IsSkipped: it.State == coretypes.ChecklistItemStateSkipped,
			TitleHTML: markdownInlineToHTML(it.Title, rt),
			DescHTML:  markdownToHTML(it.Description, rt),
			Command:   it.Command,
		}
		if !isTemplate {
			if it.AssigneeID != "" {
				item.AssigneeDisplay = resolveUserDisplay(rt, it.AssigneeID)
			}
			if it.DueAtMs > 0 {
				item.DueDateStr = formatDate(it.DueAtMs)
			}
		}
		out.Items = append(out.Items, item)
	}
	return out
}

// markdownInlineToHTML renders a single-line title via the same sanitizer
// as the block path. goldmark wraps single-paragraph input in <p>…</p>; we
// strip that wrapper so the result inlines cleanly into headings and task
// titles.
func markdownInlineToHTML(md string, rt report.ResolverTable) template.HTML {
	full := string(markdownToHTML(md, rt))
	full = strings.TrimSpace(full)
	full = strings.TrimPrefix(full, "<p>")
	full = strings.TrimSuffix(full, "</p>")
	return template.HTML(full)
}

func countClosed(items []report.RenderChecklistItem) (int, int) {
	done := 0
	for _, it := range items {
		if it.State == coretypes.ChecklistItemStateClosed || it.State == coretypes.ChecklistItemStateSkipped {
			done++
		}
	}
	return done, len(items)
}

func countTasksAcross(cls []report.RenderChecklist) (int, int) {
	done, total := 0, 0
	for _, cl := range cls {
		d, t := countClosed(cl.Items)
		done += d
		total += t
	}
	return done, total
}

// resolveUserDisplay returns "@username" if the resolver has one, otherwise
// the display name, otherwise the redacted sentinel. Matches the
// markdown_writer convention.
func resolveUserDisplay(rt report.ResolverTable, id string) string {
	if id == "" {
		return redactedUser
	}
	if u, ok := rt.Users[id]; ok {
		if u.Username != "" {
			return "@" + u.Username
		}
		if u.DisplayName != "" {
			return u.DisplayName
		}
	}
	return redactedUser
}

// resolveOwnerDisplay prefers the inline RenderUser then falls back to the
// resolver table.
func resolveOwnerDisplay(owner report.RenderUser, rt report.ResolverTable) string {
	if owner.Username != "" {
		return "@" + owner.Username
	}
	if owner.DisplayName != "" {
		return owner.DisplayName
	}
	return resolveUserDisplay(rt, owner.UserID)
}

func formatDate(ms int64) string {
	if ms <= 0 {
		return ""
	}
	return time.UnixMilli(ms).UTC().Format("2006-01-02 15:04")
}

func formatDuration(ms int64) string {
	if ms <= 0 {
		return ""
	}
	d := time.Duration(ms) * time.Millisecond
	days := int64(d / (24 * time.Hour))
	d -= time.Duration(days) * 24 * time.Hour
	hours := int64(d / time.Hour)
	d -= time.Duration(hours) * time.Hour
	mins := int64(d / time.Minute)
	d -= time.Duration(mins) * time.Minute
	secs := int64(d / time.Second)
	switch {
	case days > 0:
		return fmt.Sprintf("%dd %dh", days, hours)
	case hours > 0:
		return fmt.Sprintf("%dh %dm", hours, mins)
	case mins > 0:
		return fmt.Sprintf("%dm %ds", mins, secs)
	default:
		return fmt.Sprintf("%ds", secs)
	}
}

func computeDuration(r report.RenderRun) string {
	if r.StartTimeMs <= 0 {
		return ""
	}
	end := r.EndTimeMs
	if end <= 0 {
		end = time.Now().UnixMilli()
	}
	if end <= r.StartTimeMs {
		return ""
	}
	return formatDuration(end - r.StartTimeMs)
}

func formatMetricValue(m report.RenderMetric) string {
	if !m.HasValue {
		return "not set"
	}
	switch m.Type {
	case "duration":
		s := formatDuration(m.Value)
		if s == "" {
			return "0s"
		}
		return s
	case "currency":
		return fmt.Sprintf("%.2f", float64(m.Value)/100.0)
	default:
		return fmt.Sprintf("%d", m.Value)
	}
}

func formatMetricTarget(m report.RenderMetric) string {
	switch m.Type {
	case "duration":
		s := formatDuration(m.Target)
		if s == "" {
			return "0s"
		}
		return s
	case "currency":
		return fmt.Sprintf("%.2f", float64(m.Target)/100.0)
	default:
		return fmt.Sprintf("%d", m.Target)
	}
}

func enabledLabel(b bool) string {
	if b {
		return "Enabled"
	}
	return "Disabled"
}

// transcriptEmptyMessage picks the right copy when the rendered transcript
// is empty. Only blame channel membership when the data layer actually
// said so via TranscriptOmittedReason; otherwise emit a neutral "No
// transcript." that's honest whether the section was unrequested or the
// channel simply had no posts in window.
func transcriptEmptyMessage(reason string) string {
	switch reason {
	case coretypes.TranscriptOmittedNotMember:
		return "Transcript omitted — you are not a member of the run's channel."
	case coretypes.TranscriptOmittedNoChannel:
		return "Transcript unavailable — this run has no associated channel."
	default:
		return "No transcript."
	}
}

// filterSystemPosts drops posts with a non-empty Type (system messages) —
// mirrors the markdown_writer / PDF transcript behavior.
func filterSystemPosts(posts []report.RenderPost) []report.RenderPost {
	out := make([]report.RenderPost, 0, len(posts))
	for _, p := range posts {
		if p.Type != "" {
			continue
		}
		out = append(out, p)
	}
	return out
}

