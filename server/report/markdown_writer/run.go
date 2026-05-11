// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// RenderRunMarkdown walks rc and returns canonical Mattermost-flavored
// markdown for a playbook-run report. The output is byte-stable for fixed
// inputs and is the source of truth for the `.md` export path.
func RenderRunMarkdown(rc report.RenderContext) []byte {
	var b bytes.Buffer

	writeRunHeader(&b, rc)
	writeRunSummary(&b, rc)
	writeRunTimeline(&b, rc)
	writeRunStatusUpdates(&b, rc)
	writeRunTasks(&b, rc)
	writeRunRetrospective(&b, rc)
	writeRunTranscript(&b, rc)
	writeFooter(&b, rc.GeneratedAtMillis)

	return b.Bytes()
}

func writeRunHeader(b *bytes.Buffer, rc report.RenderContext) {
	name := rc.Run.Name
	if name == "" {
		name = "(untitled run)"
	}
	writeHeading(b, 1, name)

	owner := rc.Owner.Username
	if owner != "" {
		owner = "@" + owner
	} else {
		owner = resolveUser(rc.Resolvers, rc.Owner.UserID)
	}

	items := []metaItem{
		{Key: "Status", Value: statusDisplay(rc.Run.Status)},
		{Key: "Owner", Value: owner},
		{Key: "Started", Value: formatDate(rc.Run.StartTimeMs)},
	}
	if rc.Run.EndTimeMs > 0 {
		items = append(items, metaItem{Key: "Ended", Value: formatDate(rc.Run.EndTimeMs)})
	}
	if rc.Run.PlaybookTitle != "" {
		items = append(items, metaItem{Key: "Playbook", Value: rc.Run.PlaybookTitle})
	}
	writeMetaStrip(b, items)
	b.WriteString("\n")
}

func writeRunSummary(b *bytes.Buffer, rc report.RenderContext) {
	writeHeading(b, 2, "Executive Summary")
	if strings.TrimSpace(rc.Run.Summary) == "" {
		writeEmpty(b, "summary")
		return
	}
	writeBody(b, rc.Run.Summary)
}

func writeRunTimeline(b *bytes.Buffer, rc report.RenderContext) {
	writeHeading(b, 2, "Timeline")
	if len(rc.TimelineEvents) == 0 {
		writeEmpty(b, "timeline events")
		return
	}
	for _, ev := range rc.TimelineEvents {
		when := formatDate(ev.CreateAt)
		fmt.Fprintf(b, "- **%s** — %s\n", when, ev.Summary)
		if d := strings.TrimSpace(ev.Details); d != "" {
			for _, ln := range strings.Split(d, "\n") {
				b.WriteString("  ")
				b.WriteString(ln)
				b.WriteString("\n")
			}
		}
	}
	b.WriteString("\n")
}

func writeRunStatusUpdates(b *bytes.Buffer, rc report.RenderContext) {
	writeHeading(b, 2, "Status Updates")
	if len(rc.StatusUpdates) == 0 {
		writeEmpty(b, "status updates")
		return
	}
	for _, su := range rc.StatusUpdates {
		author := resolveUser(rc.Resolvers, su.AuthorID)
		writeHeading(b, 3, fmt.Sprintf("%s — %s", author, formatDate(su.CreateAt)))
		if strings.TrimSpace(su.Message) == "" {
			writeEmpty(b, "message")
			continue
		}
		writeBody(b, su.Message)
	}
}

func writeRunTasks(b *bytes.Buffer, rc report.RenderContext) {
	writeHeading(b, 2, "Tasks")
	if len(rc.Checklists) == 0 {
		writeEmpty(b, "tasks")
		return
	}
	for i, cl := range rc.Checklists {
		writeChecklist(b, cl, rc.Resolvers, false, fmt.Sprintf("Checklist %d", i+1))
	}
}

func writeRunRetrospective(b *bytes.Buffer, rc report.RenderContext) {
	writeHeading(b, 2, "Retrospective")
	body := strings.TrimSpace(rc.Retrospective.Body)
	hasMetrics := len(rc.Retrospective.Metrics) > 0
	if body == "" && !hasMetrics {
		writeEmpty(b, "retrospective")
		return
	}
	if body != "" {
		writeBody(b, body)
	}
	if !hasMetrics {
		return
	}
	b.WriteString("**Metrics**\n\n")
	for _, m := range rc.Retrospective.Metrics {
		fmt.Fprintf(b, "- **%s** — %s\n", m.Title, formatMetricValue(m))
		if d := strings.TrimSpace(m.Description); d != "" {
			for _, ln := range strings.Split(d, "\n") {
				b.WriteString("  ")
				b.WriteString(ln)
				b.WriteString("\n")
			}
		}
	}
	b.WriteString("\n")
}

// formatMetricValue renders one metric's value (and target hint) as a
// single string for the markdown body. The PDF renderer is responsible
// for fancy formatting; the markdown form keeps it inline-friendly.
func formatMetricValue(m report.RenderMetric) string {
	if !m.HasValue {
		return "not set"
	}
	switch m.Type {
	case "duration":
		return formatDuration(m.Value)
	case "currency":
		return fmt.Sprintf("%.2f", float64(m.Value)/100.0)
	case "integer":
		fallthrough
	default:
		return fmt.Sprintf("%d", m.Value)
	}
}

func writeRunTranscript(b *bytes.Buffer, rc report.RenderContext) {
	writeHeading(b, 2, "Transcript")

	if len(rc.Transcript) == 0 {
		// No posts at all — could be a non-member (no access) or an empty
		// channel. The orchestrator decides; we emit the canonical
		// non-member sentinel and, if truncated, append the footer.
		b.WriteString("_Transcript omitted — you are not a member of the run's channel._\n\n")
		if rc.TranscriptTruncation.Hit {
			fmt.Fprintf(b, "> _Transcript truncated (post-cap, %d posts shown)._\n\n", rc.TranscriptTruncation.Posts)
		}
		return
	}

	// Filter out system messages (Type != ""). Posts with empty Type are
	// regular user posts and are kept.
	filtered := make([]report.RenderPost, 0, len(rc.Transcript))
	for _, p := range rc.Transcript {
		if p.Type != "" {
			continue
		}
		filtered = append(filtered, p)
	}

	if len(filtered) == 0 {
		b.WriteString("_No transcript._\n\n")
		if rc.TranscriptTruncation.Hit {
			fmt.Fprintf(b, "> _Transcript truncated (post-cap, %d posts shown)._\n\n", rc.TranscriptTruncation.Posts)
		}
		return
	}

	threads := groupByThread(filtered)
	for ti, thread := range threads {
		for i, p := range thread {
			isReply := i > 0 || p.RootID != ""
			writeTranscriptPost(b, p, rc.Resolvers, isReply)
		}
		if ti < len(threads)-1 {
			b.WriteString(">\n")
		}
	}
	b.WriteString("\n")

	if rc.TranscriptTruncation.Hit {
		count := rc.TranscriptTruncation.Posts
		if count == 0 {
			count = len(filtered)
		}
		fmt.Fprintf(b, "> _Transcript truncated (post-cap, %d posts shown)._\n\n", count)
	}
}
