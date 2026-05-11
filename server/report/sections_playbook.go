// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"fmt"
	"strings"

	"github.com/johnfercher/maroto/v2/pkg/components/col"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	"github.com/johnfercher/maroto/v2/pkg/core"
)

// addPlaybookOverview emits the playbook identity + member roster.
func addPlaybookOverview(m core.Maroto, styles styleSet, pc PlaybookRenderContext, labels *Labels, opts RenderOptions) {
	title := pc.Playbook.Title
	if title == "" {
		title = "(untitled)"
	}
	m.AddRow(rowHeightSection+2, col.New(12).Add(text.New(title, styles.title())))
	addBlankRow(m, rowHeightBlockGap)

	visibility := "Private"
	if pc.Playbook.Public {
		visibility = "Public"
	}
	addLabelValue(m, styles, "Visibility", visibility)
	addLabelValue(m, styles, labels.GeneratedAt(), labels.FormatDate(pc.GeneratedAtMillis))
	addBlankRow(m, rowHeightBlockGap)

	if strings.TrimSpace(pc.Playbook.Description) != "" {
		addSubHeading(m, styles, labels.Description())
		renderMarkdownInto(m, styles, pc.Playbook.Description, pc.Resolvers)
		addBlankRow(m, rowHeightBlockGap)
	}

	addSubHeading(m, styles, labels.Members())
	if len(pc.Members) == 0 {
		addMutedText(m, styles, "No members.")
		return
	}
	for _, mem := range pc.Members {
		name := mem.DisplayName
		if name == "" {
			name = resolveUserDisplay(pc.Resolvers, mem.UserID, labels)
		}
		roles := strings.Join(mem.Roles, ", ")
		if roles == "" {
			roles = "—"
		}
		m.AddRow(rowHeightLine,
			col.New(6).Add(text.New(name, styles.body())),
			col.New(6).Add(text.New(roles, styles.meta())),
		)
	}
}

// addPlaybookChecklistTemplates emits each template checklist with its items.
func addPlaybookChecklistTemplates(m core.Maroto, styles styleSet, pc PlaybookRenderContext, labels *Labels, opts RenderOptions) {
	addSectionHeading(m, styles, labels.SectionPlaybookTemplates())

	if len(pc.ChecklistTemplates) == 0 {
		addMutedText(m, styles, "No checklist templates.")
		return
	}

	for ci, cl := range pc.ChecklistTemplates {
		title := cl.Title
		if title == "" {
			title = fmt.Sprintf("Checklist %d", ci+1)
		}
		addSubHeading(m, styles, title)

		if len(cl.Items) == 0 {
			addMutedText(m, styles, "No tasks.")
			continue
		}

		for _, it := range cl.Items {
			m.AddAutoRow(col.New(12).Add(text.New(it.Title, styles.bodyBold())))

			meta := buildTemplateItemMeta(it, pc.Resolvers, labels)
			if meta != "" {
				addMutedText(m, styles, meta)
			}
			if strings.TrimSpace(it.Description) != "" {
				renderMarkdownInto(m, styles, it.Description, pc.Resolvers)
			}
			if it.Command != "" {
				m.AddAutoRow(col.New(12).Add(text.New(it.Command, styles.code())))
			}
			addBlankRow(m, rowHeightBlockGap)
		}
	}
}

// buildTemplateItemMeta composes the muted metadata line for a template task.
// Templates carry due-date offsets (millis) rather than absolute timestamps —
// formatted via FormatDuration for human readability.
func buildTemplateItemMeta(it RenderChecklistItem, rt ResolverTable, labels *Labels) string {
	parts := make([]string, 0, 2)
	if it.AssigneeID != "" {
		parts = append(parts, fmt.Sprintf("%s: %s", labels.Assignee(), resolveUserDisplay(rt, it.AssigneeID, labels)))
	}
	if it.DueAtMs > 0 {
		parts = append(parts, fmt.Sprintf("%s: +%s", labels.DueDate(), labels.FormatDuration(it.DueAtMs)))
	}
	return strings.Join(parts, "  ·  ")
}

// addPlaybookSettings emits the playbook configuration block.
func addPlaybookSettings(m core.Maroto, styles styleSet, pc PlaybookRenderContext, labels *Labels, opts RenderOptions) {
	addSectionHeading(m, styles, labels.SectionPlaybookSettings())

	addSubHeading(m, styles, labels.StatusUpdateSettings())
	addLabelValue(m, styles, labels.Enabled(), formatEnabled(pc.StatusUpdateConfig.Enabled, labels))
	if pc.StatusUpdateConfig.Cadence != "" {
		addLabelValue(m, styles, labels.Cadence(), pc.StatusUpdateConfig.Cadence)
	}
	if strings.TrimSpace(pc.StatusUpdateConfig.Template) != "" {
		addLabelValue(m, styles, labels.Template(), "")
		renderMarkdownInto(m, styles, pc.StatusUpdateConfig.Template, pc.Resolvers)
	}
	addBlankRow(m, rowHeightBlockGap)

	addSubHeading(m, styles, labels.RetrospectiveSettings())
	addLabelValue(m, styles, labels.Enabled(), formatEnabled(pc.RetrospectiveConfig.Enabled, labels))
	if pc.RetrospectiveConfig.ReminderCadence != "" {
		addLabelValue(m, styles, labels.Cadence(), pc.RetrospectiveConfig.ReminderCadence)
	}
	if strings.TrimSpace(pc.RetrospectiveConfig.Template) != "" {
		addLabelValue(m, styles, labels.Template(), "")
		renderMarkdownInto(m, styles, pc.RetrospectiveConfig.Template, pc.Resolvers)
	}
	if len(pc.RetrospectiveConfig.Metrics) > 0 {
		addLabelValue(m, styles, labels.Metrics(), "")
		for _, met := range pc.RetrospectiveConfig.Metrics {
			line := fmt.Sprintf("%s (%s, target %d)", met.Title, met.Type, met.Target)
			m.AddAutoRow(col.New(12).Add(text.New(line, styles.body())))
			if strings.TrimSpace(met.Description) != "" {
				addMutedText(m, styles, met.Description)
			}
		}
	}
	addBlankRow(m, rowHeightBlockGap)

	addSubHeading(m, styles, labels.BroadcastChannels())
	if len(pc.BroadcastChannels) == 0 {
		addMutedText(m, styles, "None configured.")
	} else {
		for _, ch := range pc.BroadcastChannels {
			label := ch.DisplayName
			if label == "" {
				label = ch.Name
			}
			m.AddAutoRow(col.New(12).Add(text.New("#"+label, styles.body())))
		}
	}
	addBlankRow(m, rowHeightBlockGap)

	addSubHeading(m, styles, labels.SignalKeywords())
	if len(pc.SignalKeywords) == 0 {
		addMutedText(m, styles, "None configured.")
	} else {
		m.AddAutoRow(col.New(12).Add(text.New(strings.Join(pc.SignalKeywords, ", "), styles.body())))
	}
	addBlankRow(m, rowHeightBlockGap)

	addSubHeading(m, styles, labels.Webhooks())
	addWebhookList(m, styles, "On run creation", pc.WebhooksOnCreation)
	addWebhookList(m, styles, "On status update", pc.WebhooksOnStatus)
}

func formatEnabled(b bool, labels *Labels) string {
	if b {
		return labels.Enabled()
	}
	return labels.Disabled()
}

// addWebhookList emits a sub-labelled list of webhook URLs. Per plan §3.6.5 /
// MF-1 closure: read Full first; if empty, render HostMasked. Never
// reconstruct.
func addWebhookList(m core.Maroto, styles styleSet, label string, hooks []RenderWebhook) {
	if len(hooks) == 0 {
		return
	}
	addLabelValue(m, styles, label, "")
	for _, h := range hooks {
		val := h.Full
		if val == "" {
			val = h.HostMasked
		}
		if val == "" {
			continue
		}
		m.AddAutoRow(col.New(12).Add(text.New(val, styles.code())))
	}
}
