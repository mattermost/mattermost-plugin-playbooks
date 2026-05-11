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

// addCover emits the run's identity + headline status as the leading page.
func addCover(m core.Maroto, styles styleSet, rc RenderContext, labels *Labels, opts RenderOptions) {
	name := rc.Run.Name
	if name == "" {
		name = labels.UnknownUser()
	}
	m.AddRow(rowHeightSection+2, col.New(12).Add(text.New(name, styles.title())))
	addBlankRow(m, rowHeightBlockGap)

	addLabelValue(m, styles, labels.Status(), labels.StatusDisplay(rc.Run.Status))

	ownerName := rc.Owner.DisplayName
	if ownerName == "" {
		ownerName = resolveUserDisplay(rc.Resolvers, rc.Owner.UserID, labels)
	}
	addLabelValue(m, styles, labels.Owner(), ownerName)

	addLabelValue(m, styles, labels.Started(), labels.FormatDate(rc.Run.StartTimeMs))
	if rc.Run.EndTimeMs > 0 {
		addLabelValue(m, styles, labels.Ended(), labels.FormatDate(rc.Run.EndTimeMs))
		addLabelValue(m, styles, labels.Duration(), labels.FormatDuration(rc.Run.EndTimeMs-rc.Run.StartTimeMs))
	}
	if rc.Run.PlaybookTitle != "" {
		addLabelValue(m, styles, "Playbook", rc.Run.PlaybookTitle)
	}
	addLabelValue(m, styles, labels.GeneratedAt(), labels.FormatDate(rc.GeneratedAtMillis))

	addBlankRow(m, rowHeightBlockGap)
}

// addExecutiveSummary emits the markdown Summary plus a key-fields table.
func addExecutiveSummary(m core.Maroto, styles styleSet, rc RenderContext, labels *Labels, opts RenderOptions) {
	addSectionHeading(m, styles, labels.SectionExecutiveSummary())

	if strings.TrimSpace(rc.Run.Summary) != "" {
		renderMarkdownBoxedInto(m, styles, rc.Run.Summary, rc.Resolvers)
		addBlankRow(m, rowHeightBlockGap)
	}

	addLabelValue(m, styles, labels.Status(), labels.StatusDisplay(rc.Run.Status))
	ownerName := rc.Owner.DisplayName
	if ownerName == "" {
		ownerName = resolveUserDisplay(rc.Resolvers, rc.Owner.UserID, labels)
	}
	addLabelValue(m, styles, labels.Owner(), ownerName)
	addLabelValue(m, styles, labels.Started(), labels.FormatDate(rc.Run.StartTimeMs))
	if rc.Run.EndTimeMs > 0 {
		addLabelValue(m, styles, labels.Ended(), labels.FormatDate(rc.Run.EndTimeMs))
		addLabelValue(m, styles, labels.Duration(), labels.FormatDuration(rc.Run.EndTimeMs-rc.Run.StartTimeMs))
	}
}

// addTimeline emits the audit timeline as one row per event.
func addTimeline(m core.Maroto, styles styleSet, rc RenderContext, labels *Labels, opts RenderOptions) {
	addSectionHeading(m, styles, labels.SectionTimeline())

	if len(rc.TimelineEvents) == 0 {
		addMutedText(m, styles, "No timeline events.")
		return
	}

	for _, ev := range rc.TimelineEvents {
		when := labels.FormatDate(ev.CreateAt)
		actor := resolveUserDisplay(rc.Resolvers, ev.CreatorID, labels)

		m.AddRow(rowHeightLine,
			col.New(3).Add(text.New(when, styles.meta())),
			col.New(9).Add(text.New(ev.Summary, styles.bodyBold())),
		)
		if ev.Details != "" {
			m.AddAutoRow(
				col.New(3).Add(text.New("", styles.meta())),
				col.New(9).Add(text.New(ev.Details, styles.body())),
			)
		}
		m.AddRow(rowHeightLine,
			col.New(3).Add(text.New("", styles.meta())),
			col.New(9).Add(text.New(actor, styles.meta())),
		)
		addBlankRow(m, rowHeightBlockGap)
	}
}

// addStatusUpdates emits one card per status update.
func addStatusUpdates(m core.Maroto, styles styleSet, rc RenderContext, labels *Labels, opts RenderOptions) {
	addSectionHeading(m, styles, labels.SectionStatusUpdates())

	if len(rc.StatusUpdates) == 0 {
		addMutedText(m, styles, "No status updates.")
		return
	}

	for i, su := range rc.StatusUpdates {
		author := resolveUserDisplay(rc.Resolvers, su.AuthorID, labels)
		head := fmt.Sprintf("%s — %s", author, labels.FormatDate(su.CreateAt))
		addCardHeading(m, styles, head)
		renderMarkdownBoxedInto(m, styles, su.Message, rc.Resolvers)
		if i < len(rc.StatusUpdates)-1 {
			addBlankRow(m, rowHeightBlockGap)
			addDivider(m)
			addBlankRow(m, rowHeightBlockGap)
		}
	}
}

// addChecklists emits each checklist as a visually separated block with
// indented, bullet-prefixed tasks, mirroring the in-app Playbooks task UI.
func addChecklists(m core.Maroto, styles styleSet, rc RenderContext, labels *Labels, opts RenderOptions) {
	addSectionHeading(m, styles, labels.SectionChecklists())

	if len(rc.Checklists) == 0 {
		addMutedText(m, styles, "No tasks.")
		return
	}

	for ci, cl := range rc.Checklists {
		if ci > 0 {
			addBlankRow(m, rowHeightBlockGap)
			addDivider(m)
			addBlankRow(m, rowHeightBlockGap)
		}
		title := cl.Title
		if title == "" {
			title = fmt.Sprintf("Checklist %d", ci+1)
		}
		done, total := countClosed(cl.Items)
		pct := 0
		if total > 0 {
			pct = (done * 100) / total
		}
		addSubHeading(m, styles, fmt.Sprintf("%s  (%d/%d · %d%%)", title, done, total, pct))

		if len(cl.Items) == 0 {
			addTaskIndentedLine(m, styles, "No tasks.", styles.meta())
			continue
		}

		for ti, it := range cl.Items {
			if ti > 0 {
				addBlankRow(m, rowHeightBlockGap)
			}
			addTaskRow(m, styles, it.State, it.Title)

			if meta := buildChecklistItemMeta(it, rc.Resolvers, labels); meta != "" {
				addTaskIndentedLine(m, styles, meta, styles.meta())
			}
			if strings.TrimSpace(it.Description) != "" {
				renderIndentedMarkdownInto(m, styles, it.Description, rc.Resolvers)
			}
			if it.Command != "" {
				addTaskIndentedLine(m, styles, it.Command, styles.code())
			}
		}
	}
}

// buildChecklistItemMeta composes the muted metadata line for a task.
func buildChecklistItemMeta(it RenderChecklistItem, rt ResolverTable, labels *Labels) string {
	parts := make([]string, 0, 3)
	if it.AssigneeID != "" {
		parts = append(parts, fmt.Sprintf("%s: %s", labels.Assignee(), resolveUserDisplay(rt, it.AssigneeID, labels)))
	} else {
		parts = append(parts, labels.Unassigned())
	}
	if it.DueAtMs > 0 {
		parts = append(parts, fmt.Sprintf("%s: %s", labels.DueDate(), labels.FormatDate(it.DueAtMs)))
	}
	return strings.Join(parts, "  ·  ")
}

// countClosed returns (done, total) for a checklist item slice. "Done" counts
// both Closed and Skipped.
func countClosed(items []RenderChecklistItem) (int, int) {
	done := 0
	for _, it := range items {
		if it.State == "Closed" || it.State == "Skipped" {
			done++
		}
	}
	return done, len(items)
}

// addRetrospective emits the retrospective body + metrics.
func addRetrospective(m core.Maroto, styles styleSet, rc RenderContext, labels *Labels, opts RenderOptions) {
	addSectionHeading(m, styles, labels.SectionRetrospective())

	if strings.TrimSpace(rc.Retrospective.Body) != "" {
		renderMarkdownBoxedInto(m, styles, rc.Retrospective.Body, rc.Resolvers)
		addBlankRow(m, rowHeightBlockGap)
	} else {
		addMutedText(m, styles, "No retrospective body.")
	}

	if len(rc.Retrospective.Metrics) == 0 {
		return
	}

	addSubHeading(m, styles, labels.Metrics())
	for _, met := range rc.Retrospective.Metrics {
		value := formatMetricValue(met, labels)
		m.AddRow(rowHeightLine,
			col.New(5).Add(text.New(met.Title, styles.bodyBold())),
			col.New(7).Add(text.New(value, styles.body())),
		)
		if strings.TrimSpace(met.Description) != "" {
			addMutedText(m, styles, met.Description)
		}
	}
}

// formatMetricValue renders one metric's value + target as a single string.
func formatMetricValue(m RenderMetric, labels *Labels) string {
	if !m.HasValue {
		return labels.NotSet()
	}
	switch m.Type {
	case "duration":
		return labels.FormatDuration(m.Value)
	case "currency":
		return fmt.Sprintf("%.2f", float64(m.Value)/100.0)
	case "integer":
		fallthrough
	default:
		return fmt.Sprintf("%d", m.Value)
	}
}
