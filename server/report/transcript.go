// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"fmt"
	"sort"
	"strings"

	"github.com/johnfercher/maroto/v2/pkg/components/col"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	"github.com/johnfercher/maroto/v2/pkg/core"
)

// addTranscript emits the channel transcript grouped into threads (root +
// replies). Non-member runs render a sentinel page instead.
//
// Returns an updated Truncation value the orchestrator surfaces in the
// response header (post-count cap already applied upstream; this function
// records the count it actually rendered).
func addTranscript(m core.Maroto, styles styleSet, rc RenderContext, labels *Labels, opts RenderOptions) Truncation {
	addSectionHeading(m, styles, labels.SectionTranscript())

	if len(rc.Transcript) == 0 {
		addMutedText(m, styles, labels.TranscriptOmittedNonMember())
		return rc.TranscriptTruncation
	}

	threads := groupByThread(rc.Transcript)

	rendered := 0
	for _, thread := range threads {
		renderThread(m, styles, thread, rc.Resolvers, labels)
		rendered += len(thread)
		addBlankRow(m, rowHeightBlockGap)
	}

	t := rc.TranscriptTruncation
	if t.Posts == 0 {
		t.Posts = rendered
	}
	if t.Hit {
		addBlankRow(m, rowHeightBlockGap)
		addDivider(m)
		addMutedText(m, styles, labels.TranscriptTruncated(t.Reason, t.Posts))
	}
	return t
}

// groupByThread groups a chronological post slice into [root, replies...]
// runs. Posts with a RootID land under that root; orphaned replies (root not
// in the slice) are promoted to their own single-element groups so nothing
// is dropped silently.
func groupByThread(posts []RenderPost) [][]RenderPost {
	type group struct {
		posts []RenderPost
	}
	groups := make(map[string]*group, len(posts))
	order := make([]string, 0, len(posts))

	for _, p := range posts {
		rootID := p.RootID
		if rootID == "" {
			rootID = p.PostID
		}
		g, ok := groups[rootID]
		if !ok {
			g = &group{}
			groups[rootID] = g
			order = append(order, rootID)
		}
		g.posts = append(g.posts, p)
	}

	for _, id := range order {
		g := groups[id]
		sort.SliceStable(g.posts, func(i, j int) bool {
			return g.posts[i].CreateAt < g.posts[j].CreateAt
		})
	}

	out := make([][]RenderPost, 0, len(order))
	for _, id := range order {
		out = append(out, groups[id].posts)
	}
	return out
}

// renderThread emits one thread as a card: root first, replies indented.
func renderThread(m core.Maroto, styles styleSet, posts []RenderPost, rt ResolverTable, labels *Labels) {
	for i, p := range posts {
		isReply := i > 0 || p.RootID != ""
		renderPost(m, styles, p, rt, labels, isReply)
	}
}

// renderPost emits one post (header line + body). Replies are visually
// indented by giving them a leading spacer column.
func renderPost(m core.Maroto, styles styleSet, p RenderPost, rt ResolverTable, labels *Labels, isReply bool) {
	author := resolveUserDisplay(rt, p.AuthorID, labels)
	when := labels.FormatDate(p.CreateAt)
	head := fmt.Sprintf("%s — %s", author, when)

	bodyText := strings.TrimSpace(p.Message)

	if isReply {
		m.AddRow(rowHeightLine,
			col.New(1),
			col.New(11).Add(text.New(head, styles.label())),
		)
		if bodyText != "" {
			renderReplyBody(m, styles, bodyText)
		}
		return
	}

	m.AddRow(rowHeightLine, col.New(12).Add(text.New(head, styles.label())))
	if bodyText != "" {
		renderMarkdownBoxedInto(m, styles, bodyText, rt)
	}
}

// renderReplyBody emits indented body text for a thread reply.
func renderReplyBody(m core.Maroto, styles styleSet, body string) {
	for _, ln := range strings.Split(body, "\n") {
		if ln == "" {
			addBlankRow(m, rowHeightBlockGap)
			continue
		}
		m.AddAutoRow(
			col.New(1),
			col.New(11).Add(text.New(ln, styles.body())),
		)
	}
}
