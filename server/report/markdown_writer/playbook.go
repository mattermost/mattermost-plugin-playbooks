// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// RenderPlaybookMarkdown walks pc and returns canonical Mattermost-flavored
// markdown for a playbook template report. The output is byte-stable for
// fixed inputs and is the source of truth for the `.md` export path.
func RenderPlaybookMarkdown(pc report.PlaybookRenderContext) []byte {
	var b bytes.Buffer

	writePlaybookHeader(&b, pc)
	writePlaybookDescription(&b, pc)
	writePlaybookMembers(&b, pc)
	writePlaybookChecklistTemplates(&b, pc)
	writePlaybookStatusUpdates(&b, pc)
	writePlaybookRetrospective(&b, pc)
	writePlaybookAutomations(&b, pc)
	writeFooter(&b, pc.GeneratedAtMillis)

	return b.Bytes()
}

func writePlaybookHeader(b *bytes.Buffer, pc report.PlaybookRenderContext) {
	title := pc.Playbook.Title
	if title == "" {
		title = "(untitled playbook)"
	}
	writeHeading(b, 1, title)

	visibility := "Private"
	if pc.Playbook.Public {
		visibility = "Public"
	}
	items := []metaItem{
		{Key: "Type", Value: visibility},
		{Key: "Generated", Value: formatDate(pc.GeneratedAtMillis)},
	}
	writeMetaStrip(b, items)
	b.WriteString("\n")
}

func writePlaybookDescription(b *bytes.Buffer, pc report.PlaybookRenderContext) {
	writeHeading(b, 2, "Description")
	if strings.TrimSpace(pc.Playbook.Description) == "" {
		writeEmpty(b, "description")
		return
	}
	writeBody(b, pc.Playbook.Description)
}

func writePlaybookMembers(b *bytes.Buffer, pc report.PlaybookRenderContext) {
	writeHeading(b, 2, "Members")
	if len(pc.Members) == 0 {
		writeEmpty(b, "members")
		return
	}
	for _, m := range pc.Members {
		user := resolveUser(pc.Resolvers, m.UserID)
		if len(m.Roles) == 0 {
			fmt.Fprintf(b, "- %s\n", user)
			continue
		}
		fmt.Fprintf(b, "- %s (%s)\n", user, strings.Join(m.Roles, ", "))
	}
	b.WriteString("\n")
}

func writePlaybookChecklistTemplates(b *bytes.Buffer, pc report.PlaybookRenderContext) {
	writeHeading(b, 2, "Checklist Templates")
	if len(pc.ChecklistTemplates) == 0 {
		writeEmpty(b, "checklist templates")
		return
	}
	for i, cl := range pc.ChecklistTemplates {
		writeChecklist(b, cl, pc.Resolvers, true, fmt.Sprintf("Checklist %d", i+1))
	}
}

func writePlaybookStatusUpdates(b *bytes.Buffer, pc report.PlaybookRenderContext) {
	writeHeading(b, 2, "Status Updates")
	cfg := pc.StatusUpdateConfig
	tmpl := strings.TrimSpace(cfg.Template)
	if !cfg.Enabled && tmpl == "" && cfg.Cadence == "" {
		writeEmpty(b, "status update configuration")
		return
	}
	items := []metaItem{
		{Key: "Enabled", Value: enabledLabel(cfg.Enabled)},
	}
	if cfg.Cadence != "" {
		items = append(items, metaItem{Key: "Cadence", Value: cfg.Cadence})
	}
	writeMetaStrip(b, items)
	b.WriteString("\n")
	if tmpl != "" {
		writeBody(b, tmpl)
	}
}

func writePlaybookRetrospective(b *bytes.Buffer, pc report.PlaybookRenderContext) {
	writeHeading(b, 2, "Retrospective")
	cfg := pc.RetrospectiveConfig
	tmpl := strings.TrimSpace(cfg.Template)
	hasMetrics := len(cfg.Metrics) > 0
	if !cfg.Enabled && tmpl == "" && cfg.ReminderCadence == "" && !hasMetrics {
		writeEmpty(b, "retrospective configuration")
		return
	}
	items := []metaItem{
		{Key: "Enabled", Value: enabledLabel(cfg.Enabled)},
	}
	if cfg.ReminderCadence != "" {
		items = append(items, metaItem{Key: "Cadence", Value: cfg.ReminderCadence})
	}
	writeMetaStrip(b, items)
	b.WriteString("\n")
	if tmpl != "" {
		writeBody(b, tmpl)
	}
	if !hasMetrics {
		return
	}
	b.WriteString("**Metrics**\n\n")
	for _, m := range cfg.Metrics {
		fmt.Fprintf(b, "- **%s** (%s, target %s)\n", m.Title, m.Type, formatMetricTarget(m))
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

// formatMetricTarget renders the target field for a metric in a
// type-appropriate way.
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
	case "integer":
		fallthrough
	default:
		return fmt.Sprintf("%d", m.Target)
	}
}

func writePlaybookAutomations(b *bytes.Buffer, pc report.PlaybookRenderContext) {
	writeHeading(b, 2, "Automations")

	hasAny := len(pc.BroadcastChannels) > 0 ||
		len(pc.WebhooksOnCreation) > 0 ||
		len(pc.WebhooksOnStatus) > 0 ||
		len(pc.SignalKeywords) > 0

	if !hasAny {
		writeEmpty(b, "automations")
		return
	}

	writeHeading(b, 3, "Broadcast Channels")
	if len(pc.BroadcastChannels) == 0 {
		writeEmpty(b, "broadcast channels")
	} else {
		for _, ch := range pc.BroadcastChannels {
			ref := "~" + ch.Name
			if ch.Name == "" {
				ref = redactedChannel
			}
			fmt.Fprintf(b, "- %s\n", ref)
		}
		b.WriteString("\n")
	}

	writeHeading(b, 3, "Webhooks on Run Creation")
	writePlaybookWebhookList(b, pc.WebhooksOnCreation, "webhooks on run creation")

	writeHeading(b, 3, "Webhooks on Status Update")
	writePlaybookWebhookList(b, pc.WebhooksOnStatus, "webhooks on status update")

	writeHeading(b, 3, "Signal Keywords")
	if len(pc.SignalKeywords) == 0 {
		writeEmpty(b, "signal keywords")
	} else {
		for _, k := range pc.SignalKeywords {
			fmt.Fprintf(b, "- `%s`\n", k)
		}
		b.WriteString("\n")
	}
}

// writePlaybookWebhookList emits one webhook per line in a code-fenced
// inline form. Per plan §3.6.5 / MF-1: prefer Full when present (caller
// has PlaybookManage); otherwise fall back to HostMasked. Never
// reconstruct.
func writePlaybookWebhookList(b *bytes.Buffer, hooks []report.RenderWebhook, emptyThing string) {
	if len(hooks) == 0 {
		writeEmpty(b, emptyThing)
		return
	}
	for _, h := range hooks {
		val := h.Full
		if val == "" {
			val = h.HostMasked
		}
		if val == "" {
			continue
		}
		fmt.Fprintf(b, "- `%s`\n", val)
	}
	b.WriteString("\n")
}

func enabledLabel(b bool) string {
	if b {
		return "Enabled"
	}
	return "Disabled"
}
