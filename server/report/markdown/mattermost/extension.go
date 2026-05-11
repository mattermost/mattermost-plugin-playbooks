// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mattermost

import (
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/util"
)

// Inline parser priorities. We register below CodeSpan (100) and Link (200)
// so the standard inline machinery wins on conflicts (e.g., `[foo](bar)`
// and backtick spans are never swallowed by mention / channel / emoji
// recognition).
const (
	priorityMention     = 250
	priorityChannelLink = 260
	priorityEmojiText   = 270
)

// Extension is the singleton goldmark.Extender that registers the
// Mattermost-flavored inline parsers (mentions, channel links, emoji
// shortcodes).
//
// File embeds are intentionally not a goldmark inline; see file_embeds.go.
var Extension goldmark.Extender = extender{}

type extender struct{}

func (extender) Extend(m goldmark.Markdown) {
	m.Parser().AddOptions(parser.WithInlineParsers(
		util.Prioritized(NewMentionParser(), priorityMention),
		util.Prioritized(NewChannelLinkParser(), priorityChannelLink),
		util.Prioritized(NewEmojiTextParser(), priorityEmojiText),
	))
}
