// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer //nolint:staticcheck

import (
	"bytes"
	"fmt"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// RenderPlaybookMarkdown prints r as Mattermost-flavored markdown. The
// output is byte-stable for a fixed report, and @mentions are inert.
func RenderPlaybookMarkdown(r *report.PlaybookReport) []byte {
	var b bytes.Buffer

	writeHeading(&b, 1, r.Title)
	writeMetaStrip(&b, r.Meta)
	writeStats(&b, r.Stats)

	if !r.Description.Omitted {
		writeHeading(&b, 2, r.Description.Title)
		if r.Description.Body == "" {
			writeEmpty(&b, r.Description.Empty)
		}
		writeBody(&b, r.Description.Body)
	}

	if !r.Members.Omitted {
		writeHeading(&b, 2, r.Members.Title)
		if len(r.Members.Members) == 0 {
			writeEmpty(&b, r.Members.Empty)
		} else {
			for _, m := range r.Members.Members {
				if m.Roles == "" {
					fmt.Fprintf(&b, "- %s\n", escapeText(m.Name))
					continue
				}
				fmt.Fprintf(&b, "- %s (%s)\n", escapeText(m.Name), escapeText(m.Roles))
			}
			b.WriteString("\n")
		}
	}

	if !r.Checklists.Omitted {
		writeChecklists(&b, r.Checklists)
	}

	for _, s := range r.Settings() {
		if s.Omitted {
			continue
		}
		writeHeading(&b, 2, s.Title)
		if !s.Configured {
			writeEmpty(&b, s.Empty)
			continue
		}
		writeMetaStrip(&b, s.Meta)
		writeBody(&b, s.Template)
		writeMetrics(&b, s.MetricsTitle, s.Metrics, "- **%s** (%s)\n")
	}

	if a := r.Automations; !a.Omitted {
		writeHeading(&b, 2, a.Title)
		if !a.Configured {
			writeEmpty(&b, a.Empty)
		} else {
			// Channel references are left unescaped so they stay channel links.
			writeList(&b, a.BroadcastChannels, func(s string) string { return s })
			for _, l := range a.CodeLists() {
				writeList(&b, l, codeSpan)
			}
		}
	}

	writeFooter(&b, r.Footer)

	return inertMentions(b.Bytes())
}

// writeList writes a titled bulleted list, each item shown by format, or the
// list's empty state.
func writeList(b *bytes.Buffer, l report.List, format func(string) string) {
	writeHeading(b, 3, l.Title)
	if len(l.Items) == 0 {
		writeEmpty(b, l.Empty)
		return
	}
	for _, item := range l.Items {
		fmt.Fprintf(b, "- %s\n", format(item))
	}
	b.WriteString("\n")
}
