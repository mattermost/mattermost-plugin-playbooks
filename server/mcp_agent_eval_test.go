// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"

	pbtools "github.com/mattermost/mattermost-plugin-playbooks/internal/playbooksmcp/tools"
)

const (
	outcomePass    = "PASS"
	outcomePartial = "PARTIAL"
	outcomeFail    = "FAIL"
	outcomeError   = "ERROR"

	defaultAnthropicModel = "claude-sonnet-4-5-20250929"
	defaultOpenAIModel    = "gpt-5.4"
)

// TestMCPAgentEvals drives a real LLM against the Playbooks MCP tools on a real
// Mattermost server, then asserts on server state. It is opt-in because it costs
// money and needs network access.
func TestMCPAgentEvals(t *testing.T) {
	if os.Getenv("PLAYBOOKS_MCP_AGENT_EVALS") != "1" {
		t.Skip("set PLAYBOOKS_MCP_AGENT_EVALS=1 to run the Playbooks MCP agent evals")
	}

	outputDir := getEnvWithDefault("PLAYBOOKS_EVAL_OUTPUT_DIR", "/tmp/eval-results")
	providers := splitEvalList(getEnvWithDefault("PLAYBOOKS_EVAL_PROVIDERS", "anthropic,openai"))
	scenarios := filterEvalScenarios(evalScenarios(), splitEvalList(os.Getenv("PLAYBOOKS_EVAL_SCENARIOS")))
	require.NotEmpty(t, scenarios, "no scenarios selected")

	for _, providerName := range providers {
		agent, err := newEvalAgent(providerName)
		if err != nil {
			t.Errorf("provider %s unavailable: %v", providerName, err)
			continue
		}

		t.Run(providerName, func(t *testing.T) {
			t.Logf("provider %s using model %s", agent.Provider(), agent.Model())
			runEvalSuite(t, agent, scenarios, outputDir)
		})
	}
}

func newEvalAgent(provider string) (evalAgent, error) {
	switch provider {
	case "anthropic":
		key := os.Getenv("ANTHROPIC_API_KEY")
		if key == "" {
			return nil, fmt.Errorf("ANTHROPIC_API_KEY is not set")
		}
		return &anthropicAgent{apiKey: key, model: getEnvWithDefault("ANTHROPIC_MODEL", defaultAnthropicModel)}, nil
	case "openai":
		key := os.Getenv("OPENAI_API_KEY")
		if key == "" {
			return nil, fmt.Errorf("OPENAI_API_KEY is not set")
		}
		return &openAIAgent{apiKey: key, model: getEnvWithDefault("OPENAI_MODEL", defaultOpenAIModel)}, nil
	default:
		return nil, fmt.Errorf("unknown provider %q", provider)
	}
}

func runEvalSuite(t *testing.T, agent evalAgent, scenarios []evalScenario, outputDir string) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()

	providerDir := filepath.Join(outputDir, agent.Provider())
	results := make([]*evalResult, 0, len(scenarios))

	for _, scenario := range scenarios {
		res := &evalResult{Scenario: scenario.name, Outcome: outcomeError}
		results = append(results, res)

		t.Run(scenario.name, func(t *testing.T) {
			runEvalScenario(t, agent, e, scenario, res, providerDir)
		})

		if res.Outcome == outcomeError && len(res.Notes) == 0 {
			res.Notes = append(res.Notes, "harness error — see test log")
		}
	}

	summaryPath := filepath.Join(outputDir, "summary-"+agent.Provider()+".md")
	if err := writeEvalSummary(summaryPath, agent.Provider(), agent.Model(), results); err != nil {
		t.Errorf("failed to write summary: %v", err)
	}

	for _, res := range results {
		t.Logf("%-32s %-8s tools=%s notes=%s", res.Scenario, res.Outcome,
			strings.Join(res.ToolNames, ","), strings.Join(res.Notes, "; "))
	}
}

func runEvalScenario(t *testing.T, agent evalAgent, e *TestEnvironment, scenario evalScenario, res *evalResult, providerDir string) {
	ctx := context.Background()
	sc := &evalScenarioContext{Values: map[string]string{}}

	tr := &evalTranscript{
		Scenario: scenario.name,
		Provider: agent.Provider(),
		Model:    agent.Model(),
	}
	defer func() {
		res.ToolNames = tr.ToolNames()
		tr.Duration = res.Duration
		if err := writeEvalTranscript(providerDir, tr, res); err != nil {
			t.Logf("failed to write transcript: %v", err)
		}
	}()

	seeder := &evalSeeder{t: t, e: e}
	scenario.seed(seeder, sc)
	require.NotNil(t, sc.Channel, "scenario %s must seed a channel", scenario.name)

	sc.BeforeRun = snapshotRun(e, sc.RunID)
	sc.BeforePlaybook = snapshotPlaybook(e, sc.PlaybookID)

	harness, err := newEvalMCPHarness(ctx, e.RegularUser.Id, func(context.Context) (pbtools.APIClient, error) {
		return newEvalAPIClient(e.ServerClient.URL, e.ServerClient.AuthToken, e.RegularUser.Id), nil
	})
	require.NoError(t, err, "failed to build MCP harness")
	defer harness.Close()

	tr.System = evalSystemPrompt(
		e.RegularUser.Username, e.RegularUser.Id,
		e.BasicTeam.DisplayName, e.BasicTeam.Id,
		sc.Channel.DisplayName, sc.Channel.Id)
	tr.Prompt = scenario.prompt(sc)

	start := time.Now()
	tr.RunErr = agent.Run(ctx, tr.System, tr.Prompt, harness.Tools, harness.CallTool, tr)
	res.Duration = time.Since(start)

	if tr.RunErr != nil {
		res.Outcome = outcomeError
		res.Notes = append(res.Notes, "agent loop error: "+tr.RunErr.Error())
		return
	}

	notes := destructiveChangeNotes(e, sc)
	if toolErrs := tr.ToolErrors(); len(toolErrs) > 0 {
		notes = append(notes, fmt.Sprintf("%d tool error(s); first: %s → %s",
			len(toolErrs), toolErrs[0].Name, firstLine(toolErrs[0].Result)))
	}

	outcome, verifyNotes := scenario.verify(e, sc, tr)
	res.Outcome = outcome
	res.Notes = append(notes, verifyNotes...)
}

// --- Scenario plumbing --------------------------------------------------------

type evalScenarioContext struct {
	Channel        *model.Channel
	PlaybookID     string
	RunID          string
	Values         map[string]string
	BeforeRun      *client.PlaybookRun
	BeforePlaybook *client.Playbook
}

type evalScenario struct {
	name   string
	seed   func(s *evalSeeder, sc *evalScenarioContext)
	prompt func(sc *evalScenarioContext) string
	verify func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string)
}

func splitEvalList(raw string) []string {
	var out []string
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func filterEvalScenarios(all []evalScenario, names []string) []evalScenario {
	if len(names) == 0 {
		return all
	}
	wanted := map[string]bool{}
	for _, name := range names {
		wanted[name] = true
	}
	var out []evalScenario
	for _, scenario := range all {
		if wanted[scenario.name] {
			out = append(out, scenario)
		}
	}
	return out
}

// --- Seeding ------------------------------------------------------------------

type evalSeeder struct {
	t *testing.T
	e *TestEnvironment
}

func (s *evalSeeder) Channel(displayName string) *model.Channel {
	s.t.Helper()
	channel, _, err := s.e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: displayName,
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
		TeamId:      s.e.BasicTeam.Id,
	})
	require.NoError(s.t, err)
	_, _, err = s.e.ServerAdminClient.AddChannelMember(context.Background(), channel.Id, s.e.RegularUser.Id)
	require.NoError(s.t, err)
	return channel
}

// Playbook seeds a playbook the acting user can both view and edit. Passing a
// channelID links runs of this playbook to that channel instead of creating a
// new one, which is how the run-in-this-channel scenarios get their context.
func (s *evalSeeder) Playbook(title, channelID string, checklists ...client.Checklist) string {
	s.t.Helper()
	opts := client.PlaybookCreateOptions{
		Title:      title,
		TeamID:     s.e.BasicTeam.Id,
		Public:     true,
		Checklists: checklists,
		Members: []client.PlaybookMember{
			{UserID: s.e.RegularUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			{UserID: s.e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
		CreateChannelMemberOnNewParticipant:     true,
		RemoveChannelMemberOnRemovedParticipant: true,
	}
	if channelID != "" {
		opts.ChannelMode = client.PlaybookRunLinkExistingChannel
		opts.ChannelID = channelID
	}
	id, err := s.e.PlaybooksAdminClient.Playbooks.Create(context.Background(), opts)
	require.NoError(s.t, err)
	return id
}

func (s *evalSeeder) Run(name, playbookID, channelID string) *client.PlaybookRun {
	s.t.Helper()
	run, err := s.e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        name,
		OwnerUserID: s.e.RegularUser.Id,
		TeamID:      s.e.BasicTeam.Id,
		PlaybookID:  playbookID,
		ChannelID:   channelID,
	})
	require.NoError(s.t, err)
	require.NotNil(s.t, run)
	return run
}

func (s *evalSeeder) StatusUpdate(runID, message string) {
	s.t.Helper()
	require.NoError(s.t, s.e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), runID, message, 3600))
}

func evalChecklist(title string, items ...string) client.Checklist {
	checklist := client.Checklist{Title: title}
	for _, item := range items {
		checklist.Items = append(checklist.Items, client.ChecklistItem{Title: item})
	}
	return checklist
}

// --- State inspection ---------------------------------------------------------

func snapshotRun(e *TestEnvironment, runID string) *client.PlaybookRun {
	if runID == "" {
		return nil
	}
	run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), runID)
	if err != nil {
		return nil
	}
	return run
}

func snapshotPlaybook(e *TestEnvironment, playbookID string) *client.Playbook {
	if playbookID == "" {
		return nil
	}
	playbook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
	if err != nil {
		return nil
	}
	return playbook
}

func listTeamRuns(e *TestEnvironment) []client.PlaybookRun {
	results, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 0, 200, client.PlaybookRunListOptions{
		TeamID: e.BasicTeam.Id,
	})
	if err != nil {
		return nil
	}
	return results.Items
}

func findRunByName(e *TestEnvironment, name string) *client.PlaybookRun {
	runs := listTeamRuns(e)
	for i := range runs {
		if titlesMatch(runs[i].Name, name) {
			return &runs[i]
		}
	}
	return nil
}

func findTeamPlaybook(e *TestEnvironment, title string) *client.Playbook {
	results, err := e.PlaybooksAdminClient.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 200, client.PlaybookListOptions{
		WithArchived: true,
	})
	if err != nil {
		return nil
	}
	for i := range results.Items {
		if titlesMatch(results.Items[i].Title, title) {
			full, gerr := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), results.Items[i].ID)
			if gerr != nil {
				return &results.Items[i]
			}
			return full
		}
	}
	return nil
}

func findChecklistItem(checklists []client.Checklist, title string) (int, int, client.ChecklistItem, bool) {
	for ci, checklist := range checklists {
		for ii, item := range checklist.Items {
			if titlesMatch(item.Title, title) {
				return ci, ii, item, true
			}
		}
	}
	return -1, -1, client.ChecklistItem{}, false
}

func findChecklist(checklists []client.Checklist, title string) (int, client.Checklist, bool) {
	for ci, checklist := range checklists {
		if titlesMatch(checklist.Title, title) {
			return ci, checklist, true
		}
	}
	return -1, client.Checklist{}, false
}

func countItems(checklists []client.Checklist) int {
	total := 0
	for _, checklist := range checklists {
		total += len(checklist.Items)
	}
	return total
}

// titlesMatch compares user-visible titles tolerantly: case-insensitive, with
// whitespace collapsed and dash variants normalized, so an agent that writes
// "Database migration - postponed" still matches an em-dash expectation.
func titlesMatch(a, b string) bool {
	return normalizeTitle(a) == normalizeTitle(b)
}

func normalizeTitle(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	for _, dash := range []string{"—", "–", "‒", "―"} {
		s = strings.ReplaceAll(s, dash, "-")
	}
	return strings.Join(strings.Fields(s), " ")
}

func containsFold(haystack, needle string) bool {
	return strings.Contains(strings.ToLower(haystack), strings.ToLower(needle))
}

// destructiveChangeNotes flags structural damage the agent caused to the seeded
// fixtures, independent of what the scenario asked for.
func destructiveChangeNotes(e *TestEnvironment, sc *evalScenarioContext) []string {
	var notes []string

	if sc.BeforeRun != nil {
		after := snapshotRun(e, sc.RunID)
		switch {
		case after == nil:
			notes = append(notes, "DESTRUCTIVE: seeded run is no longer readable")
		default:
			if len(after.Checklists) < len(sc.BeforeRun.Checklists) {
				notes = append(notes, fmt.Sprintf("DESTRUCTIVE: run sections %d→%d", len(sc.BeforeRun.Checklists), len(after.Checklists)))
			}
			if countItems(after.Checklists) < countItems(sc.BeforeRun.Checklists) {
				notes = append(notes, fmt.Sprintf("DESTRUCTIVE: run tasks %d→%d", countItems(sc.BeforeRun.Checklists), countItems(after.Checklists)))
			}
		}
	}

	if sc.BeforePlaybook != nil {
		after := snapshotPlaybook(e, sc.PlaybookID)
		if after != nil {
			if len(after.Checklists) < len(sc.BeforePlaybook.Checklists) {
				notes = append(notes, fmt.Sprintf("DESTRUCTIVE: playbook sections %d→%d", len(sc.BeforePlaybook.Checklists), len(after.Checklists)))
			}
			if countItems(after.Checklists) < countItems(sc.BeforePlaybook.Checklists) {
				notes = append(notes, fmt.Sprintf("DESTRUCTIVE: playbook tasks %d→%d", countItems(sc.BeforePlaybook.Checklists), countItems(after.Checklists)))
			}
		}
	}

	return notes
}

// verdict turns a deterministic state check into an outcome. A miss is PARTIAL
// only when the agent told the user it could not do the thing; a silent miss is
// a failure because the user is left believing it worked.
func verdict(stateOK bool, tr *evalTranscript, notes ...string) (string, []string) {
	if stateOK {
		return outcomePass, notes
	}
	if tr.DisclosedLimitation() {
		return outcomePartial, append(notes, "agent stated it could not complete the request")
	}
	return outcomeFail, append(notes, "no correct state change and no stated limitation (silent failure or false success)")
}

// --- Scenarios ----------------------------------------------------------------

func evalScenarios() []evalScenario {
	return []evalScenario{
		scenarioStartPlaybookTerminology(),
		scenarioRunPlaybookSynonym(),
		scenarioCheckItemNatural(),
		scenarioStatusUpdate(),
		scenarioRenameRun(),
		scenarioReadStatusHistory(),
		scenarioFinishRunTerminology(),
		scenarioAddSectionWithItems(),
		scenarioCreatePlaybookNatural(),
		scenarioArchivePlaybook(),
		scenarioTemplateVsRunDisambiguation(),
		scenarioSkipTask(),
	}
}

func scenarioStartPlaybookTerminology() evalScenario {
	const playbookTitle = "Incident Response — Sev1"
	const wantRun = "Checkout API 500s"

	return evalScenario{
		name: "start_playbook_terminology",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Incident war room")
			sc.PlaybookID = s.Playbook(playbookTitle, "",
				evalChecklist("Detection", "Acknowledge the alert", "Assess customer impact"),
				evalChecklist("Mitigation", "Roll back the last deploy", "Confirm error rate recovered"))
		},
		prompt: func(*evalScenarioContext) string {
			return "Start the Incident Response playbook, call it 'Checkout API 500s'"
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string
			var fromPlaybook bool
			var strayRun *client.PlaybookRun

			runs := listTeamRuns(e)
			for i := range runs {
				if !titlesMatch(runs[i].Name, wantRun) {
					continue
				}
				if runs[i].PlaybookID == sc.PlaybookID {
					fromPlaybook = true
					break
				}
				strayRun = &runs[i]
			}

			if !fromPlaybook && strayRun != nil {
				notes = append(notes, fmt.Sprintf("created a run named %q but not from the playbook (type=%q, playbook_id=%q) — playbook checklists were not copied", wantRun, strayRun.Type, strayRun.PlaybookID))
			}
			if tr.Called("create_checklist") {
				notes = append(notes, "used create_checklist (channel checklist) rather than starting the playbook")
			}
			if tr.Called("create_playbook") {
				notes = append(notes, "WRONG TOOL: created a new playbook template instead of starting a run")
			}
			return verdict(fromPlaybook, tr, notes...)
		},
	}
}

func scenarioRunPlaybookSynonym() evalScenario {
	const playbookTitle = "Release Checklist"
	const wantRun = "Release 2.4"

	return evalScenario{
		name: "run_playbook_synonym",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Release coordination")
			sc.PlaybookID = s.Playbook(playbookTitle, "",
				evalChecklist("Pre-release", "Freeze the release branch", "Publish release notes"),
				evalChecklist("Release", "Tag the release", "Deploy to production"))
		},
		prompt: func(*evalScenarioContext) string {
			return "Run the release checklist playbook for version 2.4. Name the run 'Release 2.4'."
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string
			var fromPlaybook bool
			var strayType string

			for _, run := range listTeamRuns(e) {
				if !titlesMatch(run.Name, wantRun) {
					continue
				}
				if run.PlaybookID == sc.PlaybookID {
					fromPlaybook = true
					break
				}
				strayType = run.Type
			}

			if !fromPlaybook && strayType != "" {
				notes = append(notes, fmt.Sprintf("created a %q run named %q that is not linked to the playbook", strayType, wantRun))
			}
			if tr.Called("create_checklist") {
				notes = append(notes, "used create_checklist as a substitute for starting a playbook run")
			}
			return verdict(fromPlaybook, tr, notes...)
		},
	}
}

func scenarioCheckItemNatural() evalScenario {
	const targetTask = "Update DNS records"

	return evalScenario{
		name: "check_item_natural",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Web app deploy")
			sc.PlaybookID = s.Playbook("Web Deploy Template", sc.Channel.Id,
				evalChecklist("Deploy steps", "Freeze main branch", targetTask, "Run smoke tests"))
			sc.RunID = s.Run("Deploy web app", sc.PlaybookID, sc.Channel.Id).ID
		},
		prompt: func(*evalScenarioContext) string {
			return "Mark the Update DNS records task as done."
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string
			run := snapshotRun(e, sc.RunID)
			if run == nil {
				return outcomeError, []string{"could not read the seeded run"}
			}

			_, _, item, found := findChecklistItem(run.Checklists, targetTask)
			if !found {
				return outcomeFail, []string{"target task no longer exists in the run"}
			}
			for _, checklist := range run.Checklists {
				for _, other := range checklist.Items {
					if !titlesMatch(other.Title, targetTask) && other.State == "closed" {
						notes = append(notes, fmt.Sprintf("COLLATERAL: also closed unrelated task %q", other.Title))
					}
				}
			}
			if item.State != "" && item.State != "closed" {
				notes = append(notes, fmt.Sprintf("task ended in state %q instead of closed", item.State))
			}
			return verdict(item.State == "closed", tr, notes...)
		},
	}
}

func scenarioStatusUpdate() evalScenario {
	return evalScenario{
		name: "status_update",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Payments latency")
			sc.PlaybookID = s.Playbook("Payments Incident Template", sc.Channel.Id,
				evalChecklist("Triage", "Page the on-call engineer", "Open a customer comms thread"))
			sc.RunID = s.Run("Payments latency spike", sc.PlaybookID, sc.Channel.Id).ID
		},
		prompt: func(*evalScenarioContext) string {
			return "Post a status update on this run: we found the root cause, fix is being deployed. Remind us again in 30 minutes."
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string

			updates, err := e.PlaybooksClient.PlaybookRuns.GetStatusUpdates(context.Background(), sc.RunID)
			if err != nil {
				return outcomeError, []string{"failed to read status updates: " + err.Error()}
			}
			posted := false
			for _, update := range updates {
				if containsFold(update.Message, "root cause") {
					posted = true
				}
			}
			if len(updates) == 0 {
				notes = append(notes, "no status update was posted")
			} else if !posted {
				notes = append(notes, fmt.Sprintf("status update posted but text did not mention the root cause: %q", updates[0].Message))
			}

			reminderOK := false
			if run := snapshotRun(e, sc.RunID); run != nil {
				seconds := int64(run.PreviousReminder / time.Second)
				raw := int64(run.PreviousReminder)
				reminderOK = seconds == 1800 || raw == 1800
				notes = append(notes, fmt.Sprintf("previous_reminder=%d (=%ds)", raw, seconds))
				if !reminderOK {
					notes = append(notes, "reminder was not set to 30 minutes")
				}
			}

			if posted && !reminderOK {
				return outcomePartial, notes
			}
			return verdict(posted && reminderOK, tr, notes...)
		},
	}
}

func scenarioRenameRun() evalScenario {
	const originalName = "Database migration"
	const wantName = "Database migration — postponed"

	return evalScenario{
		name: "rename_run",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Database migration")
			sc.PlaybookID = s.Playbook("Migration Template", sc.Channel.Id,
				evalChecklist("Migration steps", "Snapshot the database", "Run the migration script"))
			sc.RunID = s.Run(originalName, sc.PlaybookID, sc.Channel.Id).ID
		},
		prompt: func(*evalScenarioContext) string {
			return "Rename this run to 'Database migration — postponed'"
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string
			run := snapshotRun(e, sc.RunID)
			if run == nil {
				return outcomeError, []string{"could not read the seeded run"}
			}

			renamed := titlesMatch(run.Name, wantName)
			if !renamed && sc.BeforeRun != nil {
				for i, checklist := range run.Checklists {
					if i < len(sc.BeforeRun.Checklists) && !titlesMatch(checklist.Title, sc.BeforeRun.Checklists[i].Title) {
						notes = append(notes, fmt.Sprintf("WRONG TARGET: renamed section %d from %q to %q instead of the run", i, sc.BeforeRun.Checklists[i].Title, checklist.Title))
					}
				}
				if tr.Called("rename_section") {
					notes = append(notes, "called rename_section while trying to rename a run")
				}
				if tr.Called("create_checklist") {
					notes = append(notes, "WRONG TOOL: created a new checklist run rather than renaming")
				}
				if tr.Called("finish_run") {
					notes = append(notes, "DESTRUCTIVE: finished the run while trying to rename it")
				}
			}
			return verdict(renamed, tr, notes...)
		},
	}
}

func scenarioReadStatusHistory() evalScenario {
	const marker = "ZULU-77"
	const latestUpdate = "Cache warmed, error rate down to 0.2 percent. Tracking marker " + marker + "."

	return evalScenario{
		name: "read_status_history",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Search outage")
			sc.PlaybookID = s.Playbook("Search Incident Template", sc.Channel.Id,
				evalChecklist("Response", "Check the search cluster", "Notify support"))
			run := s.Run("Search outage", sc.PlaybookID, sc.Channel.Id)
			sc.RunID = run.ID
			s.StatusUpdate(run.ID, "Initial triage: search cluster is returning 503s for 40 percent of queries.")
			s.StatusUpdate(run.ID, latestUpdate)
			sc.Values["marker"] = marker
		},
		prompt: func(*evalScenarioContext) string {
			return "What did the last status update on this run say?"
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string

			answered := containsFold(tr.FinalText, sc.Values["marker"]) || containsFold(tr.FinalText, "cache warmed")

			updates, err := e.PlaybooksClient.PlaybookRuns.GetStatusUpdates(context.Background(), sc.RunID)
			if err == nil && len(updates) > 2 {
				notes = append(notes, fmt.Sprintf("SIDE EFFECT: posted a new status update (now %d, seeded 2)", len(updates)))
			}
			if !answered && !tr.DisclosedLimitation() {
				notes = append(notes, "answered without the real update text — check the transcript for a hallucinated summary")
			}
			if !answered && tr.Called("get_run") {
				notes = append(notes, "called get_run, which does not return status update text")
			}
			return verdict(answered, tr, notes...)
		},
	}
}

func scenarioFinishRunTerminology() evalScenario {
	return evalScenario{
		name: "finish_run_terminology",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Payment gateway outage")
			sc.PlaybookID = s.Playbook("Gateway Incident Template", sc.Channel.Id,
				evalChecklist("Response", "Fail over to the backup gateway", "Confirm payments succeeding"))
			sc.RunID = s.Run("Payment gateway outage", sc.PlaybookID, sc.Channel.Id).ID
		},
		prompt: func(*evalScenarioContext) string {
			return "We're done here — close out this incident."
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string
			run := snapshotRun(e, sc.RunID)
			if run == nil {
				return outcomeError, []string{"could not read the seeded run"}
			}
			finished := run.CurrentStatus == "Finished" || run.EndAt != 0
			if !finished && tr.Called("update_run_status") {
				notes = append(notes, "posted a status update but did not finish the run")
			}
			return verdict(finished, tr, notes...)
		},
	}
}

func scenarioAddSectionWithItems() evalScenario {
	const sectionTitle = "Post-incident"

	return evalScenario{
		name: "add_section_with_items",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Auth service degradation")
			sc.PlaybookID = s.Playbook("Auth Incident Template", sc.Channel.Id,
				evalChecklist("Response", "Restart the auth pods", "Verify login success rate"))
			sc.RunID = s.Run("Auth service degradation", sc.PlaybookID, sc.Channel.Id).ID
		},
		prompt: func(*evalScenarioContext) string {
			return "Add a 'Post-incident' section to this run with tasks 'Schedule retro' and 'Write timeline'."
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string
			run := snapshotRun(e, sc.RunID)
			if run == nil {
				return outcomeError, []string{"could not read the seeded run"}
			}

			_, section, found := findChecklist(run.Checklists, sectionTitle)
			if !found {
				notes = append(notes, "no section named Post-incident was created")
				return verdict(false, tr, notes...)
			}
			_, _, _, hasRetro := findChecklistItem([]client.Checklist{section}, "Schedule retro")
			_, _, _, hasTimeline := findChecklistItem([]client.Checklist{section}, "Write timeline")
			if hasRetro && hasTimeline {
				return outcomePass, notes
			}

			// Sections created without their tasks are a real, recurring shape of
			// partial success worth separating from an outright miss.
			_, _, _, retroAnywhere := findChecklistItem(run.Checklists, "Schedule retro")
			_, _, _, timelineAnywhere := findChecklistItem(run.Checklists, "Write timeline")
			notes = append(notes, fmt.Sprintf("section created; 'Schedule retro' in section=%t anywhere=%t, 'Write timeline' in section=%t anywhere=%t",
				hasRetro, retroAnywhere, hasTimeline, timelineAnywhere))
			return outcomePartial, notes
		},
	}
}

func scenarioCreatePlaybookNatural() evalScenario {
	const playbookTitle = "Customer Onboarding"

	return evalScenario{
		name: "create_playbook_natural",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Customer success")
		},
		prompt: func(*evalScenarioContext) string {
			return "Create a playbook called 'Customer Onboarding' with two stages: 'Kickoff' (tasks: 'Schedule intro call', 'Send welcome packet') and 'Setup' (tasks: 'Provision account')."
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string

			playbook := findTeamPlaybook(e, playbookTitle)
			if playbook == nil {
				if run := findRunByName(e, playbookTitle); run != nil {
					notes = append(notes, fmt.Sprintf("WRONG OBJECT: created a run (type=%q) named %q instead of a playbook template", run.Type, playbookTitle))
				}
				return verdict(false, tr, notes...)
			}

			kickoffIdx, kickoff, hasKickoff := findChecklist(playbook.Checklists, "Kickoff")
			setupIdx, setup, hasSetup := findChecklist(playbook.Checklists, "Setup")
			if !hasKickoff || !hasSetup {
				notes = append(notes, fmt.Sprintf("playbook created but stages are wrong: %s", checklistTitles(playbook.Checklists)))
				return outcomePartial, notes
			}
			if kickoffIdx > setupIdx {
				notes = append(notes, "stages are in the wrong order")
			}

			_, _, _, hasIntro := findChecklistItem([]client.Checklist{kickoff}, "Schedule intro call")
			_, _, _, hasWelcome := findChecklistItem([]client.Checklist{kickoff}, "Send welcome packet")
			_, _, _, hasProvision := findChecklistItem([]client.Checklist{setup}, "Provision account")
			exact := hasIntro && hasWelcome && hasProvision &&
				len(playbook.Checklists) == 2 && len(kickoff.Items) == 2 && len(setup.Items) == 1

			if !exact {
				notes = append(notes, fmt.Sprintf("checklists=%s (intro=%t welcome=%t provision=%t)",
					checklistTitles(playbook.Checklists), hasIntro, hasWelcome, hasProvision))
				if hasIntro && hasWelcome && hasProvision {
					notes = append(notes, "all requested tasks present but extra stages/tasks were invented")
					return outcomePartial, notes
				}
				return outcomePartial, notes
			}
			return outcomePass, notes
		},
	}
}

func scenarioArchivePlaybook() evalScenario {
	const playbookTitle = "Legacy Process 2019"

	return evalScenario{
		name: "archive_playbook",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Process cleanup")
			sc.PlaybookID = s.Playbook(playbookTitle, "",
				evalChecklist("Legacy steps", "File the paper form", "Fax the approval"),
				evalChecklist("Sign-off", "Get the director signature"))
		},
		prompt: func(*evalScenarioContext) string {
			return "Archive the Legacy Process 2019 playbook, we don't use it anymore."
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string
			playbook := snapshotPlaybook(e, sc.PlaybookID)
			if playbook == nil {
				return outcomeError, []string{"could not read the seeded playbook"}
			}
			archived := playbook.DeleteAt != 0

			if !archived {
				if tr.Called("remove_playbook_section") {
					notes = append(notes, "DESTRUCTIVE INTENT: called remove_playbook_section instead of archiving")
				}
				if tr.Called("remove_playbook_task") {
					notes = append(notes, "DESTRUCTIVE INTENT: called remove_playbook_task instead of archiving")
				}
				if tr.Called("rename_playbook_section") || tr.Called("edit_playbook_task") {
					notes = append(notes, "edited the playbook contents instead of archiving it")
				}
				notes = append(notes, fmt.Sprintf("playbook still active with %d sections / %d tasks", len(playbook.Checklists), countItems(playbook.Checklists)))
			}
			return verdict(archived, tr, notes...)
		},
	}
}

func scenarioTemplateVsRunDisambiguation() evalScenario {
	const newTask = "Update runbook link"

	return evalScenario{
		name: "template_vs_run_disambiguation",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Deployment build 88")
			sc.PlaybookID = s.Playbook("Deployment", sc.Channel.Id,
				evalChecklist("Deploy", "Notify stakeholders", "Deploy to production"))
			sc.RunID = s.Run("Deployment — build 88", sc.PlaybookID, sc.Channel.Id).ID
		},
		prompt: func(*evalScenarioContext) string {
			return "Add a task 'Update runbook link' to the deployment playbook so it's there for future runs."
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string

			playbook := snapshotPlaybook(e, sc.PlaybookID)
			run := snapshotRun(e, sc.RunID)
			if playbook == nil || run == nil {
				return outcomeError, []string{"could not read the seeded playbook or run"}
			}

			_, _, _, inTemplate := findChecklistItem(playbook.Checklists, newTask)
			_, _, _, inRun := findChecklistItem(run.Checklists, newTask)

			switch {
			case inTemplate && inRun:
				notes = append(notes, "added to the template and also to the in-progress run")
			case !inTemplate && inRun:
				notes = append(notes, "WRONG TARGET: added the task to the in-progress run only; future runs will not have it")
				return outcomeFail, notes
			case !inTemplate && !inRun:
				notes = append(notes, "task was not added anywhere")
			}
			return verdict(inTemplate, tr, notes...)
		},
	}
}

func scenarioSkipTask() evalScenario {
	const targetTask = "Notify legal team"

	return evalScenario{
		name: "skip_task",
		seed: func(s *evalSeeder, sc *evalScenarioContext) {
			sc.Channel = s.Channel("Vendor breach")
			sc.PlaybookID = s.Playbook("Vendor Breach Template", sc.Channel.Id,
				evalChecklist("Response", targetTask, "Rotate vendor credentials", "Assess data exposure"))
			sc.RunID = s.Run("Vendor breach", sc.PlaybookID, sc.Channel.Id).ID
		},
		prompt: func(*evalScenarioContext) string {
			return "Skip the notify legal task, it doesn't apply to this incident."
		},
		verify: func(e *TestEnvironment, sc *evalScenarioContext, tr *evalTranscript) (string, []string) {
			var notes []string
			run := snapshotRun(e, sc.RunID)
			if run == nil {
				return outcomeError, []string{"could not read the seeded run"}
			}

			_, _, item, found := findChecklistItem(run.Checklists, targetTask)
			if !found {
				notes = append(notes, "DESTRUCTIVE: the task was deleted rather than skipped")
				return outcomeFail, notes
			}
			if item.State == "closed" {
				notes = append(notes, "WRONG SEMANTICS: marked the task done instead of skipped")
				return outcomeFail, notes
			}
			if item.State != "skipped" {
				notes = append(notes, fmt.Sprintf("task state is %q", displayItemState(item.State)))
			}
			return verdict(item.State == "skipped", tr, notes...)
		},
	}
}

func checklistTitles(checklists []client.Checklist) string {
	parts := make([]string, 0, len(checklists))
	for _, checklist := range checklists {
		items := make([]string, 0, len(checklist.Items))
		for _, item := range checklist.Items {
			items = append(items, item.Title)
		}
		parts = append(parts, fmt.Sprintf("%s[%s]", checklist.Title, strings.Join(items, ", ")))
	}
	return strings.Join(parts, " / ")
}

func displayItemState(state string) string {
	if state == "" {
		return "open"
	}
	return state
}

func firstLine(s string) string {
	line := strings.TrimSpace(strings.SplitN(s, "\n", 2)[0])
	if len(line) > 200 {
		return line[:200] + "…"
	}
	return line
}
