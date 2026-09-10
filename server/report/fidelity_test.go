// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"testing"
)

// TestFidelityHarness_Scaffold is the placeholder for the fidelity-harness
// regression suite called out in plan §6.1 A0 (DA-2 closure).
//
// When the markdown pipeline lands (Phase A3 / A5), this test grows into a
// table-driven runner that:
//  1. Iterates a fixed corpus of representative Mattermost markdown bodies
//     (mentions, channel links, file embeds, shortcode emoji, code blocks,
//     lists, hostile-link bypass attempts).
//  2. Renders each into the markdown extension's typed instruction stream
//     (NOT the full PDF — keeps the harness fast and stable against font /
//     library version bumps).
//  3. Asserts the instruction sequence against a golden baseline checked
//     into testdata/.
//  4. Catches accidental regressions (a goldmark bump that drops bold) AND
//     accidental over-rendering (a permalink resolver call escaping into v1).
//
// Today, the body is a sanity check that the test infra compiles. Real
// fixtures land alongside the markdown extension in Phase A5.1–A5.4.
func TestFidelityHarness_Scaffold(t *testing.T) {
	t.Log("fidelity harness scaffold: ready for fixtures in Phase A5")
}
