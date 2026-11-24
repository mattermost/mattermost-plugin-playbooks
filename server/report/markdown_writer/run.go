// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer //nolint:staticcheck

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// RenderRunMarkdown prints r as Mattermost-flavored markdown. The output is
// byte-stable for a fixed report, and @mentions are inert so pasting it into
// Mattermost notifies no one.
func RenderRunMarkdown(r *report.RunReport) []byte {
	var b bytes.Buffer

	writeHeading(&b, 1, r.Title)

	writeHeading(&b, 2, r.Summary.Title)
	if r.Summary.Body == "" {
		writeEmpty(&b, r.Summary.Empty)
	}
	writeBody(&b, r.Summary.Body)
	writeStats(&b, r.Stats)
	writeMetaStrip(&b, append([]report.Field{r.Status}, r.Meta...))
	if len(r.Participants) > 0 {
		writeMetaStrip(&b, []report.Field{{Label: r.ParticipantsLabel, Value: strings.Join(r.Participants, ", ")}})
	}

	writeHeading(&b, 2, r.StatusUpdates.Title)
	if len(r.StatusUpdates.Updates) == 0 {
		writeEmpty(&b, r.StatusUpdates.Empty)
	}
	for _, su := range r.StatusUpdates.Updates {
		writeHeading(&b, 3, fmt.Sprintf("%s · %s", su.Author, su.Date))
		if su.Body == "" {
			writeEmpty(&b, r.StatusUpdates.NoMessage)
		}
		writeBody(&b, su.Body)
	}

	if !r.Timeline.Omitted {
		writeHeading(&b, 2, r.Timeline.Title)
		if len(r.Timeline.Events) == 0 {
			writeEmpty(&b, r.Timeline.Empty)
		} else {
			for _, ev := range r.Timeline.Events {
				headline := ev.Headline
				if ev.PlainHeadline {
					headline = escapeText(headline)
				}
				fmt.Fprintf(&b, "- **%s** · _%s_: %s\n", escapeText(ev.Date), escapeText(ev.TypeLabel), headline)
				if ev.Detail != "" {
					writeLines(&b, closeFences(ev.Detail, 2), "  ")
				}
			}
			b.WriteString("\n")
		}
	}

	if !r.Retrospective.Omitted {
		writeHeading(&b, 2, r.Retrospective.Title)
		if r.Retrospective.Note != "" {
			writeEmpty(&b, r.Retrospective.Note)
		} else if r.Retrospective.Body == "" && len(r.Retrospective.Metrics) == 0 {
			writeEmpty(&b, r.Retrospective.Empty)
		}
		writeBody(&b, r.Retrospective.Body)
		writeMetrics(&b, r.Retrospective.MetricsTitle, r.Retrospective.Metrics)
	}

	if !r.Tasks.Omitted {
		writeChecklists(&b, r.Tasks)
	}

	if !r.Transcript.Omitted {
		writeTranscript(&b, r.Transcript)
	}
	writeFooter(&b, r.Footer)

	return inertMentions(b.Bytes())
}
