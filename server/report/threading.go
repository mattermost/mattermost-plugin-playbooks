// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import "sort"

// CollateThreads groups a flat slice of RenderPost into threads keyed by
// RootID. Each output thread is [root, reply1, reply2, ...]. Replies are
// matched to their root by RootID == root.PostID (the canonical Mattermost
// thread relation); CreateAt is used ONLY for display order, never for
// grouping:
//
//   * Threads in the returned slice are sorted by their root's CreateAt
//     ascending — readers scan threads in the order conversations started.
//   * Replies within a thread are sorted by their own CreateAt ascending —
//     conversation order within the thread.
//
// Posts whose RootID points at a root not in this slice (orphans — the
// parent was deleted, predates the run window, or was permission-filtered)
// are returned in a second slice. The caller decides how to render them;
// the renderers in this codebase emit them under an explicit "Orphan
// replies" subsection so the reader knows the parent existed and is
// missing, instead of the orphan reply being silently promoted to a root.
//
// CollateThreads is the canonical model for the Threaded transcript mode
// (coretypes.TranscriptModeThreaded) and is shared by markdown_writer and
// html_writer. The Chronological mode bypasses this function and emits
// posts in pure CreateAt order with ↳ indicators.
func CollateThreads(posts []RenderPost) (threads [][]RenderPost, orphans []RenderPost) {
	rootIdx := make(map[string]int, len(posts)) // root.PostID → index in `threads`
	for _, p := range posts {
		if p.RootID == "" {
			rootIdx[p.PostID] = len(threads)
			threads = append(threads, []RenderPost{p})
		}
	}
	for _, p := range posts {
		if p.RootID == "" {
			continue
		}
		if i, ok := rootIdx[p.RootID]; ok {
			threads[i] = append(threads[i], p)
			continue
		}
		orphans = append(orphans, p)
	}
	sort.SliceStable(threads, func(i, j int) bool {
		return threads[i][0].CreateAt < threads[j][0].CreateAt
	})
	for i := range threads {
		replies := threads[i][1:]
		sort.SliceStable(replies, func(a, b int) bool {
			return replies[a].CreateAt < replies[b].CreateAt
		})
	}
	sort.SliceStable(orphans, func(i, j int) bool {
		return orphans[i].CreateAt < orphans[j].CreateAt
	})
	return threads, orphans
}
