# Quicklist Feature - Implementation Plan

This plan outlines the phases to implement the Quicklist feature as described in `DESIGN-quicklists.md`.

---

## Phase 1: Foundation

### 1.1 Configuration

**Tasks:**
- [x] Add configuration fields to `/server/config/config.go`:
  - `QuicklistEnabled` (bool)
  - `QuicklistAgentBotID` (string)
  - `QuicklistMaxMessages` (int, default: 50)
  - `QuicklistMaxCharacters` (int, default: 10000)
  - `QuicklistSystemPrompt` (text)
  - `QuicklistUserPrompt` (text)
- [x] Update `plugin.json` with settings schema
- [x] Add configuration validation

**Testing:**
- [x] Unit test: Configuration defaults are applied correctly
- [x] Unit test: Configuration validation rejects invalid values
- [ ] Manual test: Settings appear in System Console

**Implementation Notes:**
- The `Configuration` struct is in `/server/config/configuration.go`, not `config.go`. The `config.go` file contains only the `Service` interface.
- JSON tags use lowercase to match Mattermost's plugin settings schema (e.g., `json:"quicklistenabled"`).
- The `serialize()` method in `configuration.go` must include all new fields for `SavePluginConfig` to persist changes.
- `SetDefaults()` is always called before `Validate()` in both `NewConfigService()` and `OnConfigurationChange()`. Future validation logic should assume defaults have been applied.
- Validation errors are logged as warnings but don't block plugin loading. The feature won't work until config is fixed, but the plugin remains operational.
- When exposing a config check (like `IsQuicklistEnabled()`), add the method to the `Service` interface in `config.go` and implement it in `ServiceImpl` in `service.go`.
- `QuicklistAgentBotID` validation is conditional: only required when `QuicklistEnabled` is true. This allows admins to disable the feature without clearing the bot ID.

### 1.2 Thread Fetching

**Tasks:**
- [ ] Create `/server/app/thread.go` with `ThreadService`
- [ ] Implement `FetchAndFormatThread(postID string) (*ThreadContent, error)`
- [ ] Implement helper functions:
  - `sortPostsByTime()`
  - `keepRecentWithRoot()`
  - `countParticipants()`
  - `formatThreadContent()`
- [ ] Handle truncation (message count and character limits)

**Testing:**
- [ ] Unit test: Thread formatting produces expected output format
- [ ] Unit test: Truncation keeps root post and most recent messages
- [ ] Unit test: Character limit truncation works correctly
- [ ] Unit test: Participant counting is accurate
- [ ] Unit test: Empty thread handling
- [ ] Unit test: Single-post thread (no replies)

### 1.3 Slash Command Skeleton

**Tasks:**
- [ ] Create `/server/command/quicklist.go`
- [ ] Register `quicklist` subcommand in `/server/command/command.go`
- [ ] Add autocomplete data
- [ ] Implement basic validation:
  - Post ID required
  - Post exists
  - User has channel access
  - Channel is not archived
- [ ] Send `quicklist_open_modal` WebSocket event

**Testing:**
- [ ] Unit test: Command rejects missing post ID
- [ ] Unit test: Command rejects invalid post ID
- [ ] Unit test: Command checks channel permissions
- [ ] Unit test: Command rejects archived channel
- [ ] Integration test: WebSocket event is sent with correct payload

### 1.4 Basic Modal UI

**Tasks:**
- [ ] Create `/webapp/src/components/modals/quicklist_modal.tsx`
- [ ] Create `/webapp/src/components/quicklist/quicklist_section.tsx`
- [ ] Create `/webapp/src/components/quicklist/quicklist_item.tsx`
- [ ] Create `/webapp/src/components/quicklist/index.ts`
- [ ] Create `/webapp/src/types/quicklist.ts` with TypeScript types:
  - `GeneratedChecklist`, `Checklist`, `ChecklistItem`
  - `ThreadInfo` with fields: `truncated`, `truncated_count`, `message_count`, `participant_count`
  - `QuicklistGenerateResponse`, `QuicklistRefineRequest`
- [ ] Export new types from `/webapp/src/types/index.ts`
- [ ] Register modal in `/webapp/src/index.tsx`
- [ ] Set up WebSocket event listener in `/webapp/src/index.tsx`:
  - Subscribe to `quicklist_open_modal` event on plugin initialization
  - Extract `post_id` and `channel_id` from event payload
  - Open modal with extracted props
- [ ] Display loading state

**Testing:**
- [ ] Unit test: Modal renders without crashing
- [ ] Unit test: Modal displays loading state initially
- [ ] Unit test: Section component renders collapsed/expanded states
- [ ] Unit test: Item component renders title, description, due date
- [ ] Unit test: WebSocket event listener correctly parses payload
- [ ] Manual test: Modal opens when WebSocket event received

**Phase 1 Deliverable:** Running `/playbook quicklist <post_id>` opens a modal showing a loading state.

---

## Phase 2: AI Integration

### 2.1 Bridge Client Dependency

**Tasks:**
- [ ] Add `github.com/mattermost/mattermost-plugin-agents/public/bridgeclient` to `go.mod`
- [ ] Run `go mod tidy`
- [ ] Verify import works

**Testing:**
- [ ] Build succeeds with new dependency

### 2.2 AI Service

**Tasks:**
- [ ] Create `/server/app/ai_service.go`
- [ ] Implement `AIService` struct with bridge client
- [ ] Implement `IsAvailable() error`
- [ ] Implement `GenerateChecklist(req QuicklistGenerateRequest) (*GeneratedChecklist, error)`
- [ ] Define `GeneratedChecklist`, `GeneratedSection`, `GeneratedItem` types
- [ ] Implement `ToChecklists()` conversion function
- [ ] Implement `parseDueDate()` helper
- [ ] Add default prompts as constants
- [ ] Initialize AIService in `/server/plugin.go`

**Testing:**
- [ ] Unit test: `IsAvailable()` returns error when plugin unavailable
- [ ] Unit test: `GenerateChecklist()` returns error when agent not configured
- [ ] Unit test: `parseDueDate()` parses valid ISO dates
- [ ] Unit test: `parseDueDate()` returns 0 for empty/invalid dates
- [ ] Unit test: `ToChecklists()` converts sections correctly
- [ ] Unit test: `ToChecklists()` generates unique IDs
- [ ] Mock test: AI completion request is formatted correctly

### 2.3 Generate API Endpoint

**Tasks:**
- [ ] Create `/server/api/quicklist.go`
- [ ] Implement `POST /api/v0/quicklist/generate` handler
- [ ] Wire up thread fetching + AI service
- [ ] Return structured response with:
  - `title` (string) - AI-suggested run name
  - `checklists` ([]Checklist) - converted from AI sections
  - `thread_info` object containing:
    - `truncated` (bool)
    - `truncated_count` (int)
    - `message_count` (int)
    - `participant_count` (int)
- [ ] Mount handler in `/server/api/api.go`
- [ ] Add feature flag check (QuicklistEnabled)

**Testing:**
- [ ] Unit test: Returns 403 when feature disabled
- [ ] Unit test: Returns 400 for missing post_id
- [ ] Unit test: Returns 404 for non-existent post
- [ ] Unit test: Returns 403 when user lacks channel access
- [ ] Unit test: Returns 503 when AI service unavailable
- [ ] Unit test: Response includes all thread_info fields
- [ ] Integration test: Full flow from request to AI response

### 2.4 Display Generated Checklist

**Tasks:**
- [ ] Create `/webapp/src/client/quicklist.ts` with REST client functions:
  - Follow existing Playbooks client patterns (see `/webapp/src/client/`)
  - Use `doFetch` or similar helper for base URL and auth headers
  - Export `generateQuicklist(postId, channelId)` function
  - Export `refineQuicklist(postId, channelId, checklists, feedback)` function
- [ ] Create `/webapp/src/hooks/use_quicklist.ts` with `useQuicklistGenerate` hook
- [ ] Update modal to call generate API on mount
- [ ] Display AI-suggested run title (read-only, users refine via feedback)
- [ ] Display generated checklist (sections and items)
- [ ] Display thread_info:
  - Show truncation warning banner when `truncated` is true
  - Include count: "X messages not analyzed"
  - Show participant count in thread summary
- [ ] Handle and display errors

**Testing:**
- [ ] Unit test: Hook handles loading/success/error states
- [ ] Unit test: Modal displays AI-suggested title
- [ ] Unit test: Modal displays checklist sections correctly
- [ ] Unit test: Modal displays truncation warning when `thread_info.truncated` is true
- [ ] Unit test: Modal displays correct truncated message count
- [ ] Unit test: Modal displays error message on failure
- [ ] E2E test: Full flow from command to displayed checklist

**Phase 2 Deliverable:** Running `/playbook quicklist <post_id>` shows AI-generated checklist in modal.

---

## Phase 3: Feedback & Run Creation

### 3.1 Refine API Endpoint

**Tasks:**
- [ ] Implement `POST /api/v0/quicklist/refine` handler
- [ ] Accept current checklists + feedback text
- [ ] Call AI with refinement prompt including current state and feedback
- [ ] Return updated checklist structure

**Testing:**
- [ ] Unit test: Refine endpoint validates required fields
- [ ] Unit test: Refine request includes current checklist state
- [ ] Unit test: AI prompt includes user feedback
- [ ] Integration test: Refinement modifies checklist based on feedback

### 3.2 Feedback UI

**Tasks:**
- [ ] Add feedback input field to modal
- [ ] Add "Send" button for feedback submission
- [ ] Implement `handleFeedbackSubmit` to call refine API
- [ ] Show "Updating checklist..." loading state during refinement
- [ ] Update displayed checklist with refined results
- [ ] Clear feedback input after successful refinement

**Testing:**
- [ ] Unit test: Feedback input is controlled component
- [ ] Unit test: Send button disabled when feedback empty
- [ ] Unit test: Loading state shown during refinement
- [ ] Unit test: Checklist updates after successful refinement
- [ ] Manual test: Multiple refinement cycles work correctly

### 3.3 Run Creation

**Tasks:**
- [ ] Implement `handleCreateRun` in modal:
  1. Create run via `POST /api/v0/runs`
  2. Rename default checklist to first section title
  3. Add items to first checklist
  4. For each additional section: create checklist, add items
- [ ] Add "Create Run" button with loading state
- [ ] Navigate to run view after successful creation
- [ ] Close modal after navigation

**Testing:**
- [ ] Unit test: Run creation calls correct sequence of APIs
- [ ] Unit test: All sections are created as checklists
- [ ] Unit test: All items are added to correct checklists
- [ ] Unit test: Due dates are passed correctly
- [ ] Integration test: Created run has expected structure
- [ ] E2E test: Full flow from command to navigating to new run

**Phase 3 Deliverable:** Users can refine checklist via feedback and create a playbook run.

---

## Phase 4: Polish & Hardening

### 4.1 Error Handling

**Tasks:**
- [ ] Add retry button for transient errors (AI unavailable, network issues)
- [ ] Improve error messages (see Section 11.1 in design doc)
- [ ] Add error boundaries in React components
- [ ] Log errors server-side for debugging
- [ ] Implement `quicklist_generation_failed` WebSocket event:
  - Server sends event when async generation fails
  - Include error type and user-friendly message in payload
  - Webapp listens for event and displays error in modal (if open) or toast notification

**Testing:**
- [ ] Unit test: Retry button triggers new API call
- [ ] Unit test: Error boundary catches component errors
- [ ] Unit test: `quicklist_generation_failed` event displays error correctly
- [ ] Manual test: All error cases show appropriate messages

### 4.2 Loading States & UX

**Tasks:**
- [ ] Add skeleton loading state for checklist
- [ ] Add progress indicator for run creation (multiple API calls)
- [ ] Disable form inputs during loading/creation
- [ ] Add confirmation before closing modal with unsaved changes

**Testing:**
- [ ] Unit test: Skeleton renders during loading
- [ ] Unit test: Inputs disabled during appropriate states
- [ ] Unit test: Close confirmation shown when checklists modified
- [ ] Manual test: UX feels responsive and clear

### 4.3 Feature Flag & Permissions

**Tasks:**
- [ ] Check `QuicklistEnabled` in command handler
- [ ] Check `QuicklistEnabled` in API endpoints
- [ ] Return appropriate error when feature disabled
- [ ] Add permission check for creating runs (if applicable)

**Testing:**
- [ ] Unit test: Command returns error when feature disabled
- [ ] Unit test: API returns 403 when feature disabled
- [ ] Integration test: Feature toggle works end-to-end

### 4.4 Edge Cases

**Tasks:**
- [ ] Handle empty thread (single post with no actionable items)
- [ ] Handle AI returning empty checklist
- [ ] Handle AI returning malformed JSON
- [ ] Handle very long section/item titles (truncate for display)
- [ ] Handle special characters in content

**Testing:**
- [ ] Unit test: Empty checklist shows helpful message
- [ ] Unit test: Malformed AI response shows retry option
- [ ] Unit test: Long titles are truncated with ellipsis
- [ ] Unit test: Special characters don't break rendering

**Phase 4 Deliverable:** Production-ready feature with robust error handling.

---

## Phase 5: Documentation & Release

### 5.1 Documentation

**Tasks:**
- [ ] Add admin documentation for configuration
- [ ] Add user documentation for `/playbook quicklist` command
- [ ] Document required mattermost-plugin-agents setup
- [ ] Add troubleshooting guide

### 5.2 Release Checklist

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] E2E tests passing
- [ ] Manual QA complete
- [ ] Performance tested with large threads
- [ ] Security review complete
- [ ] Documentation reviewed
- [ ] Feature flag defaulted to `false` for initial release

---

## Test Summary

| Phase | Unit Tests | Integration Tests | E2E Tests | Manual Tests |
|-------|------------|-------------------|-----------|--------------|
| Phase 1 | ~15 | 1 | 0 | 2 |
| Phase 2 | ~12 | 2 | 1 | 0 |
| Phase 3 | ~8 | 2 | 1 | 1 |
| Phase 4 | ~8 | 1 | 0 | 2 |
| **Total** | **~43** | **6** | **2** | **5** |

---

## Dependencies

- `mattermost-plugin-agents` must be installed and configured
- Existing Playbooks APIs for run/checklist management
- Bridge client library from agents plugin

---

## Design Clarifications

The following clarify decisions not fully specified in the design document:

1. **Run Name**: The AI suggests a run title which is displayed read-only in the modal. Users who want to change the name should use the feedback input to request a different title from the AI.

2. **Due Date Format**:
   - AI returns ISO 8601 date strings (e.g., `"2024-01-15"`)
   - `parseDueDate()` converts to Unix timestamp in **milliseconds** (not seconds)
   - API expects `int64` milliseconds since epoch (verified from `server/app/playbook.go:308`)

3. **Run Creation**: Always creates a new run. Appending to existing runs is not supported.

4. **Agent Configuration**: The agent bot ID is explicitly configured via `QuicklistAgentBotID` in plugin settings. No auto-discovery.

---

## Open Items to Verify

Before starting implementation:

1. [ ] Verify `POST /api/v0/runs/{id}/checklists` endpoint exists for creating additional checklists
2. [ ] Verify `PUT /api/v0/runs/{id}/checklists/{index}` endpoint exists for renaming checklists
3. [ ] Confirm bridge client API signatures match design
4. [ ] Confirm WebSocket event infrastructure in webapp
5. [ ] Determine where same-channel security test belongs (see below)

### Security: Same-Channel Constraint

The design (Section 12.2) requires: "Run is always created in the same channel as the source thread to prevent leaking thread content to other channels."

**Question**: Where should this security test be added?
- Option A: Phase 3.3 Run Creation tests
- Option B: Phase 4.3 Feature Flag & Permissions tests
- Option C: Both locations
