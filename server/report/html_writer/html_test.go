// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html_writer

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
)

// fixtureRun returns a small but section-complete RenderContext.
func fixtureRun() report.RenderContext {
	return report.RenderContext{
		Run: report.RenderRun{
			ID:            "run1",
			Name:          "Run Alpha",
			Summary:       "Brief outage. **Resolved.**",
			Status:        "InProgress",
			StartTimeMs:   1_700_000_000_000,
			EndTimeMs:     0,
			PlaybookID:    "pb1",
			PlaybookTitle: "PB Alpha",
		},
		Owner: report.RenderUser{UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
		Participants: []report.RenderUser{
			{UserID: "u1", Username: "alice"},
			{UserID: "u2", Username: "bob"},
		},
		StatusUpdates: []report.RenderStatusUpdate{
			{PostID: "p1", AuthorID: "u1", CreateAt: 1_700_000_100_000, Message: "Investigating."},
		},
		TimelineEvents: []report.RenderTimelineEvent{
			{EventType: "incident_created", CreateAt: 1_700_000_200_000, Summary: "Run created", Details: "by alice", CreatorID: "u1"},
		},
		Checklists: []report.RenderChecklist{
			{
				Title: "Initial response",
				Items: []report.RenderChecklistItem{
					{Title: "Page on-call", State: "closed", AssigneeID: "u1"},
					{Title: "Open war room", State: "skipped"},
					{Title: "Postmortem doc", State: "", DueAtMs: 1_700_001_000_000, Description: "Write it up.", Command: "/postmortem create"},
				},
			},
		},
		Retrospective: report.RenderRetrospective{
			Body: "## What went well\n- Quick paging",
			Metrics: []report.RenderMetric{
				{ID: "m1", Title: "Time to detect", Type: "duration", Target: 5 * 60 * 1000, Value: 3 * 60 * 1000, HasValue: true},
			},
		},
		Transcript: []report.RenderPost{
			{PostID: "tp1", AuthorID: "u1", CreateAt: 1_700_000_300_000, Message: "Looking into it."},
			{PostID: "tp2", AuthorID: "u2", CreateAt: 1_700_000_400_000, Message: "Same here.", RootID: "tp1"},
		},
		Resolvers: report.ResolverTable{
			Users: map[string]report.RenderUser{
				"u1": {UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
				"u2": {UserID: "u2", DisplayName: "Bob Builder", Username: "bob"},
			},
		},
		GeneratedAtMillis: 1_700_000_900_000,
	}
}

func fixturePlaybook() report.PlaybookRenderContext {
	return report.PlaybookRenderContext{
		Playbook: report.RenderPlaybook{
			ID:          "pb1",
			Title:       "Sev1 Incident Response",
			Description: "Standard response **playbook**.",
			Public:      true,
			TeamID:      "t1",
		},
		Members: []report.RenderPlaybookMember{
			{UserID: "u1", DisplayName: "Alice Admin", Roles: []string{"playbook_admin"}},
			{UserID: "u2", DisplayName: "Bob Builder"},
		},
		ChecklistTemplates: []report.RenderChecklist{
			{
				Title: "Triage",
				Items: []report.RenderChecklistItem{
					{Title: "Acknowledge alert"},
					{Title: "Verify scope", Description: "Check dashboards", Command: "/dash open"},
				},
			},
		},
		StatusUpdateConfig: report.RenderStatusUpdateConfig{
			Enabled:  true,
			Template: "**What's the latest?**",
			Cadence:  "Every 30 minutes",
		},
		RetrospectiveConfig: report.RenderRetrospectiveConfig{
			Enabled:         true,
			Template:        "## Retro",
			ReminderCadence: "After resolution",
			Metrics: []report.RenderMetric{
				{ID: "m1", Title: "TTD", Type: "duration", Target: 5 * 60 * 1000},
			},
		},
		BroadcastChannels: []report.RenderChannel{
			{ChannelID: "c1", Name: "incidents", DisplayName: "Incidents", Type: "O"},
		},
		WebhooksOnCreation: []report.RenderWebhook{
			{Full: "https://hooks.example.com/abc", HostMasked: "https://hooks.example.com/****"},
		},
		WebhooksOnStatus: []report.RenderWebhook{
			{HostMasked: "https://hooks.example.com/****"},
		},
		SignalKeywords: []string{"sev1", "outage"},
		Resolvers: report.ResolverTable{
			Users: map[string]report.RenderUser{
				"u1": {UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
				"u2": {UserID: "u2", DisplayName: "Bob Builder", Username: "bob"},
			},
		},
		GeneratedAtMillis: 1_700_000_900_000,
	}
}

func TestRenderRunHTML_Smoke(t *testing.T) {
	rc := fixtureRun()
	out, err := RenderRunHTML(rc, Options{Title: "Run Alpha Report", PageSize: "A4"})
	if err != nil {
		t.Fatalf("RenderRunHTML failed: %v", err)
	}
	if !utf8.Valid(out) {
		t.Fatalf("output is not valid UTF-8")
	}

	s := string(out)
	mustContain(t, s, []string{
		"<!doctype html>",
		"<html",
		"Content-Security-Policy",
		"Run Alpha Report",      // title
		"Run Alpha",             // h1
		"In Progress",           // status pill
		"@alice",                // owner and participants
		"@bob",                  // participants
		"Summary",               // section heading
		"Brief outage",          // summary body
		"<strong>Resolved.</strong>", // markdown rendered
		"Timeline",              // section
		"Run created",           // timeline summary
		"timeline-event__label", // per-event type label chip
		"Status Updates",        // section
		"Investigating.",        // status body
		"Tasks",                 // section
		"Initial response",      // checklist
		"Page on-call",          // task title
		"Postmortem doc",        // task
		"/postmortem create",    // command
		"Retrospective",         // section
		"What went well",        // retro body heading
		"Time to detect",        // metric
		"Transcript",            // section
		"Looking into it.",      // transcript body
		"Same here.",            // transcript reply
		`@page`,                 // CSS includes @page
		"size: A4",              // page size hint applied
	})
	mustNotContain(t, s, []string{"<script", "javascript:", "onerror"})
}

func TestRenderRunHTML_TranscriptOmitted_NotMember(t *testing.T) {
	rc := fixtureRun()
	rc.Transcript = nil
	rc.TranscriptOmittedReason = coretypes.TranscriptOmittedNotMember
	out, err := RenderRunHTML(rc, Options{})
	if err != nil {
		t.Fatalf("RenderRunHTML failed: %v", err)
	}
	if !strings.Contains(string(out), "you are not a member of the run") {
		t.Fatalf("expected not-member sentinel, got:\n%s", out)
	}
}

func TestRenderRunHTML_TranscriptEmpty_NoReason(t *testing.T) {
	rc := fixtureRun()
	rc.Transcript = nil
	rc.TranscriptOmittedReason = ""
	out, err := RenderRunHTML(rc, Options{})
	if err != nil {
		t.Fatalf("RenderRunHTML failed: %v", err)
	}
	if !strings.Contains(string(out), "No transcript") {
		t.Fatalf("expected 'No transcript' fallback, got:\n%s", out)
	}
	if strings.Contains(string(out), "not a member") {
		t.Fatalf("must not blame channel membership when reason is empty, got:\n%s", out)
	}
}

func TestRenderRunHTML_DefaultPageSize(t *testing.T) {
	rc := fixtureRun()
	out, err := RenderRunHTML(rc, Options{})
	if err != nil {
		t.Fatalf("RenderRunHTML failed: %v", err)
	}
	if !strings.Contains(string(out), "size: Letter") {
		t.Fatalf("expected default Letter page size, got output:\n%s", out)
	}
}

func TestRenderPlaybookHTML_Smoke(t *testing.T) {
	pc := fixturePlaybook()
	out, err := RenderPlaybookHTML(pc, Options{Title: "PB Report", PageSize: "Letter"})
	if err != nil {
		t.Fatalf("RenderPlaybookHTML failed: %v", err)
	}
	if !utf8.Valid(out) {
		t.Fatalf("output is not valid UTF-8")
	}

	s := string(out)
	mustContain(t, s, []string{
		"<!doctype html>",
		"Content-Security-Policy",
		"PB Report",                            // title
		"Sev1 Incident Response",               // h1
		"Public",                               // visibility pill
		"Standard response",                    // description body
		"<strong>playbook</strong>",            // markdown survives
		"Members",                              // section
		"@alice",                               // member display
		"playbook_admin",                       // role
		"Checklist Templates",                  // section
		"Triage",                               // checklist title
		"Acknowledge alert",                    // task
		"/dash open",                           // command
		"Status Updates",                       // section
		"Every 30 minutes",                     // cadence
		"What&#39;s the latest?",               // template markdown (apostrophe gets HTML-escaped by goldmark)
		"Retrospective",                        // section
		"After resolution",                     // retro cadence
		"TTD",                                  // metric
		"Automations",                          // section
		"~incidents",                           // broadcast channel
		"https://hooks.example.com/abc",        // unmasked webhook (caller is admin)
		"https://hooks.example.com/****",       // masked webhook
		"sev1",                                 // signal keyword
		"outage",
	})
	mustNotContain(t, s, []string{"<script", "javascript:", "onerror"})
}

func TestRenderPlaybookHTML_EmptyAutomations(t *testing.T) {
	pc := fixturePlaybook()
	pc.BroadcastChannels = nil
	pc.WebhooksOnCreation = nil
	pc.WebhooksOnStatus = nil
	pc.SignalKeywords = nil

	out, err := RenderPlaybookHTML(pc, Options{})
	if err != nil {
		t.Fatalf("RenderPlaybookHTML failed: %v", err)
	}
	if !strings.Contains(string(out), "No automations") {
		t.Fatalf("expected 'No automations' sentinel, got:\n%s", out)
	}
}

// TestRenderRunHTML_MaliciousMarkdownNeutralized confirms an attacker
// shoving raw HTML / javascript URLs into status updates or summaries
// cannot escape into executable output.
func TestRenderRunHTML_MaliciousMarkdownNeutralized(t *testing.T) {
	rc := fixtureRun()
	rc.Run.Summary = `<script>steal()</script> and [click](javascript:steal())`
	rc.StatusUpdates[0].Message = `<img src=x onerror="steal()">`
	rc.Retrospective.Body = `<iframe src="http://evil.example"></iframe>`

	out, err := RenderRunHTML(rc, Options{})
	if err != nil {
		t.Fatalf("RenderRunHTML failed: %v", err)
	}
	lower := strings.ToLower(string(out))
	mustNotContainLower(t, lower, []string{
		"<script", "</script", "steal(",
		"javascript:",
		"onerror",
		"<iframe", "evil.example",
	})
}

// --- helpers ---

func mustContain(t *testing.T, s string, subs []string) {
	t.Helper()
	for _, sub := range subs {
		if !strings.Contains(s, sub) {
			t.Errorf("output missing expected substring %q", sub)
		}
	}
}

func mustNotContain(t *testing.T, s string, subs []string) {
	t.Helper()
	lower := strings.ToLower(s)
	for _, sub := range subs {
		if strings.Contains(lower, strings.ToLower(sub)) {
			t.Errorf("output contains forbidden substring %q", sub)
		}
	}
}

func mustNotContainLower(t *testing.T, lower string, subs []string) {
	t.Helper()
	for _, sub := range subs {
		if strings.Contains(lower, strings.ToLower(sub)) {
			t.Errorf("output contains forbidden substring %q", sub)
		}
	}
}
