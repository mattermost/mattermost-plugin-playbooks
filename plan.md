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
- [x] Manual test: Settings appear in System Console

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
- [x] Create `/server/app/thread.go` with `ThreadService`
- [x] Implement `FetchAndFormatThread(postID string) (*ThreadContent, error)`
- [x] Implement helper functions:
  - `sortPostsByTime()`
  - `keepRecentWithRoot()`
  - `countParticipants()`
  - `formatThreadContent()`
- [x] Handle truncation (message count and character limits)

**Testing:**
- [x] Unit test: Thread formatting produces expected output format
- [x] Unit test: Truncation keeps root post and most recent messages
- [x] Unit test: Character limit truncation works correctly
- [x] Unit test: Participant counting is accurate
- [x] Unit test: Empty thread handling
- [x] Unit test: Single-post thread (no replies)

**Implementation Notes:**
- Uses `plugin.API` directly instead of `pluginapi.Client`. Errors return as `*model.AppError`. Future services should be consistent with this choice.
- **Truncation order matters**: Message count truncation happens first, then character truncation. If both limits are exceeded, the message-count notice (`[Thread truncated: X messages]`) could get cut off by character truncation. The character notice always appears at the end.
- Participant list is built from posts *after* message truncation. Users who only appear in truncated middle messages won't be listed.
- User cache uses individual `GetUser` calls per unique participant. Acceptable for typical threads (3-10 participants) but could be slow for 50+ unique users.
- Channel fetch errors are silently ignored (`channel, _ := ...`) for graceful degradation. This makes debugging harder if channel fetches consistently fail.
- **Zero config pitfall**: If `QuicklistMaxMessages` is 0 (uninitialized config), `keepRecentWithRoot` returns empty results. Code relies on `SetDefaults()` being called first.
- All timestamps formatted as UTC regardless of user locale.
- Character limit cuts at byte boundary, potentially mid-word. Not message-boundary aware.

### 1.3 Slash Command Skeleton

**Tasks:**
- [x] Create `/server/command/quicklist.go`
- [x] Register `quicklist` subcommand in `/server/command/command.go`
- [x] Add autocomplete data
- [x] Implement basic validation:
  - Post ID required
  - Post exists
  - User has channel access
  - Channel is not archived
- [x] Send `quicklist_open_modal` WebSocket event

**Testing:**
- [x] Unit test: Command rejects missing post ID
- [x] Unit test: Command rejects invalid post ID
- [x] Unit test: Command checks channel permissions
- [x] Unit test: Command rejects archived channel
- [x] Unit test: WebSocket event is sent with correct payload

**Implementation Notes:**
- Validation order: feature flag -> args -> ID format -> post exists -> permission -> archived. Cheapest checks first.
- `model.IsValidId(postID)` validates format before API calls to avoid unnecessary DB queries.
- Command channel (`r.args.ChannelId`) may differ from post channel (`post.ChannelId`). The WebSocket event correctly uses the post's channel.
- Test files require a full `config.Service` mock. Consider extracting to `server/config/mocks/mock_service.go` if more command tests need it.

### 1.4 Basic Modal UI

**Tasks:**
- [x] Create `/webapp/src/components/modals/quicklist_modal.tsx`
- [x] Create `/webapp/src/components/quicklist/quicklist_section.tsx`
- [x] Create `/webapp/src/components/quicklist/quicklist_item.tsx`
- [x] Create `/webapp/src/components/quicklist/index.ts`
- [x] Create `/webapp/src/types/quicklist.ts` with TypeScript types:
  - `Checklist`, `ChecklistItem` (reused from `playbook.ts`)
  - `ThreadInfo` with fields: `truncated`, `truncated_count`, `message_count`, `participant_count`
  - `QuicklistGenerateResponse`, `QuicklistRefineRequest`, `QuicklistModalProps`
- [x] Register modal in `/webapp/src/index.tsx`
- [x] Set up WebSocket event listener in `/webapp/src/index.tsx`:
  - Subscribe to `quicklist_open_modal` event on plugin initialization
  - Extract `post_id` and `channel_id` from event payload
  - Open modal with extracted props
- [x] Display loading state

**Testing:**
- [x] Unit test: Modal renders without crashing
- [x] Unit test: Modal displays loading state initially
- [x] Unit test: Section component renders collapsed/expanded states
- [x] Unit test: Item component renders title, description, due date
- [x] Unit test: WebSocket event listener correctly parses payload
- [x] Manual test: Modal opens when WebSocket event received

**Implementation Notes:**
- Reused existing `Checklist` and `ChecklistItem` types from `/webapp/src/types/playbook.ts` instead of creating new ones.
- No central `types/index.ts` exists in the codebase; types are imported directly from their source files.
- WebSocket event constant added to `/webapp/src/types/websocket_events.ts` as `WEBSOCKET_QUICKLIST_OPEN_MODAL`.
- WebSocket handler added to `/webapp/src/websocket_events.ts` as `handleWebsocketQuicklistOpenModal`.
- Action creator `openQuicklistModal` added to `/webapp/src/actions.ts` for programmatic modal opening.
- Modal displays loading spinner with "Analyzing thread..." text. Phase 2 will implement the actual API call.
- **WebSocket payload case conversion**: Server sends snake_case (`post_id`, `channel_id`), handler converts to camelCase for React props. Future WebSocket events should follow this pattern.
- **Deferred props pattern**: `postId` and `channelId` are accepted but marked with `eslint-disable` comments. Phase 2 will remove these when implementing the API call.
- **Loading state is hardcoded**: `useState(true)` with no setter. Phase 2 must add `setLoading` and manage state based on API response.
- **Confirm handler is empty**: Phase 3 must implement `handleCreateRun` in the modal.
- **Test mock for webapp_globals**: Tests mock `src/webapp_globals` to provide `modals.openModal`. Future modal-related tests need this pattern.
- **No content truncation**: `QuicklistItem` renders full title/description without truncation. Phase 4.4 should address very long AI-generated content.

**Phase 1 Deliverable:** Running `/playbook quicklist <post_id>` opens a modal showing a loading state.

---

## Phase 2: AI Integration

### 2.1 Bridge Client Dependency

**Tasks:**
- [x] Add `github.com/mattermost/mattermost-plugin-ai/public/bridgeclient` to `go.mod` (via replace directive to local `../mattermost-plugin-agents`)
- [x] Run `go mod tidy`
- [x] Verify import works

**Testing:**
- [x] Build succeeds with new dependency

**Implementation Notes:**
- The module path is `github.com/mattermost/mattermost-plugin-ai` (the repo is named `mattermost-plugin-agents` but the Go module kept the original name).
- Using a `replace` directive for local development: `replace github.com/mattermost/mattermost-plugin-ai => ../mattermost-plugin-agents`
- The `require` directive is added automatically by `go mod tidy` when code imports the bridgeclient package.

### 2.2 AI Service

**Tasks:**
- [x] Create `/server/app/ai_service.go`
- [x] Implement `AIService` struct with bridge client
- [x] Implement `IsAvailable() error`
- [x] Implement `GenerateChecklist(req QuicklistGenerateRequest) (*GeneratedChecklist, error)`
- [x] Define `GeneratedChecklist`, `GeneratedSection`, `GeneratedItem` types
- [x] Implement `ToChecklists()` conversion function
- [x] Implement `parseDueDate()` helper
- [x] Add default prompts as constants
- [x] Initialize AIService in `/server/plugin.go`

**Testing:**
- [x] Unit test: `IsAvailable()` returns error when plugin unavailable
- [x] Unit test: `GenerateChecklist()` returns error when agent not configured
- [x] Unit test: `parseDueDate()` parses valid ISO dates
- [x] Unit test: `parseDueDate()` returns 0 for empty/invalid dates
- [x] Unit test: `ToChecklists()` converts sections correctly
- [x] Unit test: `ToChecklists()` generates unique IDs
- [x] Mock test: AI completion request is formatted correctly

**Implementation Notes:**
- **ChecklistItemState clarification**: The design doc shows `State: "Open"` but the actual constant is `ChecklistItemStateOpen = ""` (empty string) in `server/app/playbook.go:517`. Using `State: ""` is correct.
- **BridgeClient interface**: Added `BridgeClient` interface for testability (not in original design). This allows mocking the bridge client in tests without network calls.
- **NewAIService signature change**: Design showed `NewAIService(pluginAPI *pluginapi.Client, config)` but implementation uses `NewAIService(bridgeClient BridgeClient, config)`. The `plugin.go` creates the real `bridgeclient.NewClient(p.API)` and passes it in.
- **Shared test mocks**: `mockConfigService` is defined in `server/app/thread_test.go` and shared across all `app` package tests (including `ai_service_test.go`).
- **Markdown code fence stripping**: LLMs often wrap JSON responses in markdown code fences (`` ```json ... ``` ``) even when instructed not to. `stripMarkdownCodeFences()` removes these wrappers before JSON parsing. Handles both ```` ```json ```` and plain ```` ``` ```` prefixes.

### 2.3 Generate API Endpoint

**Tasks:**
- [x] Create `/server/api/quicklist.go`
- [x] Implement `POST /api/v0/quicklist/generate` handler
- [x] Wire up thread fetching + AI service
- [x] Return structured response with:
  - `title` (string) - AI-suggested run name
  - `checklists` ([]Checklist) - converted from AI sections
  - `thread_info` object containing:
    - `truncated` (bool)
    - `truncated_count` (int)
    - `message_count` (int)
    - `participant_count` (int)
- [x] Mount handler in `/server/plugin.go` (Note: handlers are mounted in plugin.go, not api.go)
- [x] Add feature flag check (QuicklistEnabled)

**Testing:**
- [x] Unit test: Returns 403 when feature disabled
- [x] Unit test: Returns 400 for missing post_id
- [x] Unit test: Returns 404 for non-existent post
- [x] Unit test: Returns 404 when user lacks channel access (prevents enumeration)
- [x] Unit test: Returns 503 when AI service unavailable
- [x] Unit test: Response includes all thread_info fields
- [x] Integration test: Full flow from request to AI response (tests validation path; AI unavailable returns 503 as expected)

**Implementation Notes:**
- Handler is mounted in `plugin.go` (not `api.go`) to follow existing patterns for other handlers in this codebase.
- The handler uses the plugin API directly (`plugin.API`) for post/channel operations, consistent with how `ThreadService` is implemented.
- Added validation for invalid post ID format (returns 400) before attempting to fetch post.
- Added check for archived channels (returns 400) to prevent generating quicklists from archived content.
- **Security**: No channel access returns 404 (not 403) to prevent enumeration of private channels/posts.
- **Request simplification**: Removed `channel_id` from `QuicklistGenerateRequest`. The channel is always derived from `post.ChannelId` since the design requires runs to be created in the same channel as the source thread (DESIGN Section 12.2). Accepting a user-provided channel_id would be both unused and potentially misleading.

### 2.4 Display Generated Checklist

**Tasks:**
- [x] Create REST client function for generate endpoint:
  - Added `generateQuicklist(postId)` to `/webapp/src/client.ts` (follows existing pattern)
  - `channelId` removed from signature per Phase 2.3 simplification
  - `refineQuicklist` deferred to Phase 3.1
- [x] Create `/webapp/src/hooks/use_quicklist.ts` with `useQuicklistGenerate` hook
- [x] Update modal to call generate API on mount
- [x] Display AI-suggested run title (read-only, users refine via feedback)
- [x] Display generated checklist (sections and items)
- [x] Display thread_info:
  - Show truncation warning banner when `truncated` is true
  - Include count: "X messages not analyzed"
  - Show participant count in thread summary
- [x] Handle and display errors

**Testing:**
- [x] Unit test: Hook handles loading/success/error states
- [x] Unit test: Modal displays AI-suggested title
- [x] Unit test: Modal displays checklist sections correctly
- [x] Unit test: Modal displays truncation warning when `thread_info.truncated` is true
- [x] Unit test: Modal displays correct truncated message count
- [x] Unit test: Modal displays error message on failure
- [ ] E2E test: Full flow from command to displayed checklist

**Implementation Notes:**
- Client function added to existing `client.ts` rather than creating separate file, following codebase convention.
- Hook wraps all errors as `ClientError` for consistent consumer handling. `status_code: 0` indicates non-HTTP error.
- Hook uses cancellation flag to prevent state updates after unmount.
- Modal tests mock the hook (`useQuicklistGenerate`), not the client, for proper test isolation.
- Added empty state handling when AI returns no checklists.

**Phase 2 Deliverable:** Running `/playbook quicklist <post_id>` shows AI-generated checklist in modal.

---

## Phase 3: Feedback & Run Creation

### 3.1 Refine API Endpoint

**Tasks:**
- [x] Implement `POST /api/v0/quicklist/refine` handler
- [x] Accept current checklists + feedback text
- [x] Call AI with refinement prompt including current state and feedback
- [x] Return updated checklist structure

**Testing:**
- [x] Unit test: Refine endpoint validates required fields
- [x] Unit test: Refine request includes current checklist state
- [x] Unit test: AI prompt includes user feedback
- [ ] Integration test: Refinement modifies checklist based on feedback

**Implementation Notes:**
- `QuicklistRefineRequest` in `api/quicklist.go` accepts `post_id`, `current_checklists`, and `feedback`. No `channel_id` parameter - same reasoning as Phase 2.3: channel is derived from the post, preventing misuse and reducing API surface.
- `RefineChecklist` method in `app/ai_service.go` builds a 4-message conversation: system prompt, original thread (user), previous checklist as JSON (assistant), feedback request (user).
- `checklistsToGeneratedJSON()` converts Playbooks checklists back to AI format for context.
- `formatDueDate()` converts Unix milliseconds back to ISO 8601 date strings.
- Uses same validation and permission checks as generate endpoint (feature flag, post exists, channel access, archived check, AI availability).

### 3.2 Feedback UI

**Tasks:**
- [x] Add feedback input field to modal
- [x] Add "Send" button for feedback submission
- [x] Implement `handleFeedbackSubmit` to call refine API
- [x] Show "Updating checklist..." loading state during refinement
- [x] Update displayed checklist with refined results
- [x] Clear feedback input after successful refinement

**Testing:**
- [x] Unit test: Feedback input is controlled component
- [x] Unit test: Send button disabled when feedback empty
- [x] Unit test: Loading state shown during refinement
- [x] Unit test: Checklist updates after successful refinement
- [ ] Manual test: Multiple refinement cycles work correctly

**Implementation Notes:**
- `refineQuicklist` client function added to `client.ts`. Accepts `post_id`, `current_checklists`, and `feedback` (no `channel_id` needed per Phase 2.3 simplification).
- Modal maintains local state for refined data via `currentData` useState. Falls back to initial `useQuicklistGenerate` data when not refined.
- Feedback input uses controlled textarea with Enter to submit (Shift+Enter for newline).
- Refining overlay displayed over checklists container with semi-transparent background.
- Errors from refinement are displayed using the same error UI as generation errors (uses `refineError` state).

### 3.3 Run Creation

**Tasks:**
- [x] Implement `handleCreateRun` in modal:
  1. Create run via `POST /api/v0/runs`
  2. Rename default checklist to first section title
  3. Add items to first checklist
  4. For each additional section: create checklist, add items
- [x] Add "Create Run" button with loading state
- [x] Navigate to run view after successful creation
- [x] Close modal after navigation

**Testing:**
- [x] Unit test: Run creation calls correct sequence of APIs
- [x] Unit test: All sections are created as checklists
- [x] Unit test: All items are added to correct checklists
- [x] Unit test: Due dates are passed correctly
- [ ] Integration test: Created run has expected structure
- [ ] E2E test: Full flow from command to navigating to new run

**Implementation Notes:**
- Modal uses Redux selectors (`getCurrentUserId`, `getCurrentTeamId`) to get current user and team context.
- Run is created with empty `playbook_id` to create a `RunTypeChannelChecklist` (channel checklist type).
- The default "Tasks" checklist at index 0 is renamed to the first section title, then additional checklists are created for subsequent sections.
- Items are added sequentially to each checklist using `clientAddChecklistItem`.
- Navigation uses `navigateToPluginUrl` with `/runs/{id}?from=quicklist` to redirect to the new run.
- Error handling displays errors via the modal's error UI (same pattern as generation/refinement errors).
- `isCreatingRun` state disables the confirm button and shows "Creating..." text during run creation.

**Phase 3 Deliverable:** Users can refine checklist via feedback and create a playbook run.

---

## Phase 4: Polish & Hardening

### 4.1 Error Handling

**Tasks:**
- [x] Add retry button for transient errors (AI unavailable, network issues)
- [x] Improve error messages (see Section 11.1 in design doc)
- [x] Add error boundaries in React components
- [x] Log errors server-side for debugging
- [x] Implement `quicklist_generation_failed` WebSocket event:
  - Server sends event when async generation fails
  - Include error type and user-friendly message in payload
  - Webapp listens for event and displays error in modal (if open) or toast notification

**Testing:**
- [x] Unit test: Retry button triggers new API call
- [x] Unit test: Error boundary catches component errors
- [x] Unit test: `quicklist_generation_failed` event displays error correctly
- [ ] Manual test: All error cases show appropriate messages

**Implementation Notes:**
- **Error Classification Pattern**: All 5xx errors classified as `ServiceUnavailable`. Transient errors (retryable) include: 5xx, status 0 (network), timeout messages. Permanent errors: 4xx (except timeout-related).
- **React Error Boundaries**: Must be class components - `getDerivedStateFromError` and `componentDidCatch` have no hooks equivalent.
- **Hook Retry Pattern**: Uses `retryCount` state with `useCallback` to trigger re-fetch via `useEffect` dependency. Avoids exposing fetch function directly.
- **WebSocket Event**: `publishGenerationFailedEvent` is infrastructure only - not wired to error paths. Current flow is synchronous. Would be needed for async/background generation.
- **Linting Gotchas**: `import-newlines/enforce` (>3 elements), `sort-imports` (alphabetical), `no-empty-function` (needs disable for empty promises), `formatjs/no-literal-string-in-jsx`, `lines-around-comment`.
- **Testing**: Project uses `react-test-renderer` not `@testing-library/react`. Use `renderer.create()`, `toJSON()`, `toTree()` for assertions.
- **Mock Updates**: When hooks add new return values (like `retry`), all test mocks must include them.
- **Server Logging**: Build logger context incrementally with `logger.WithField()` through the handler for traceable logs.

### 4.2 Loading States & UX

**Tasks:**
- [x] Add skeleton loading state for checklist
- [x] Add progress indicator for run creation (multiple API calls)
- [x] Disable form inputs during loading/creation
- [x] Add confirmation before closing modal with unsaved changes

**Testing:**
- [x] Unit test: Skeleton renders during loading
- [x] Unit test: Inputs disabled during appropriate states
- [x] Unit test: Close confirmation shown when checklists modified
- [ ] Manual test: UX feels responsive and clear

**Implementation Notes:**
- Created `QuicklistSkeleton` component (`quicklist_skeleton.tsx`) with animated skeleton bars matching the section/item structure.
- Progress indicator shows percentage and step count (e.g., "Creating... (75%)" and "5 of 8 steps complete").
- All form inputs (feedback textarea, send button) disabled during loading, refining, and creating states via `isFormDisabled` flag.
- `UnsavedChangesModal` shows when user tries to cancel after refinement. Uses `hasUnsavedChanges` state set after successful refinement.
- Modal's `autoCloseOnCancelButton` set to `false` to intercept cancel and show confirmation when needed.

### 4.3 Post Menu Action

**Tasks:**
- [x] Add `QuicklistPostMenuText` component to `/webapp/src/components/post_menu.tsx`
- [x] Add `makeQuicklistPostAction` function to `/webapp/src/components/post_menu.tsx`
- [x] Register post menu action in `/webapp/src/index.tsx`
- [x] Import `openQuicklistModal` action in `post_menu.tsx`

**Testing:**
- [x] Unit test: Post menu action calls `openQuicklistModal` with correct postId and channelId
- [x] Unit test: Post menu action is filtered out for system messages
- [ ] Manual test: Menu item appears in post dropdown menu
- [ ] Manual test: Clicking menu item opens quicklist modal

**Implementation Notes:**
- Uses existing `shouldShowPostMenuForPost` filter (shows on all non-system posts)
- Uses existing `PlaybookRunPostMenuIcon` for consistency with other playbook actions
- Label: "Generate checklist with AI"
- Opens the same `QuicklistModal` used by the slash command

### 4.4 Feature Flag & Permissions

**Tasks:**
- [x] Check `QuicklistEnabled` in command handler
- [x] Check `QuicklistEnabled` in API endpoints
- [x] Return appropriate error when feature disabled
- [x] Add permission check for creating runs (if applicable)

**Testing:**
- [x] Unit test: Command returns error when feature disabled
- [x] Unit test: API returns 403 when feature disabled
- [ ] Integration test: Feature toggle works end-to-end

**Implementation Notes:**
- Command handler checks feature flag at `server/command/quicklist.go:17-21`. Returns user-friendly message when disabled.
- API endpoints (`generate` and `refine`) check feature flag at `server/api/quicklist.go:121-124` and `:245-248`. Return HTTP 403 when disabled.
- Permission check for creating runs is NOT NEEDED as a separate implementation. The existing run creation API (`POST /api/v0/runs` in `playbook_runs.go`) already validates:
  - `PermissionRunCreate` on the team for channel checklist runs
  - `PermissionCreatePost` for posting in the target channel
  - Quicklist endpoints already validate `PermissionReadChannel` for the source thread
- Unit tests exist in `server/command/quicklist_test.go` (`TestActionQuicklist_FeatureDisabled`) and `server/api/quicklist_test.go` (`TestQuicklistGenerate_FeatureDisabled`, `TestQuicklistRefine_FeatureDisabled`).

### 4.5 Edge Cases

**Tasks:**
- [x] Handle empty thread (single post with no actionable items)
- [x] Handle AI returning empty checklist
- [x] Handle AI returning malformed JSON
- [x] Handle very long section/item titles (truncate for display)
- [x] Handle special characters in content

**Testing:**
- [x] Unit test: Empty checklist shows helpful message
- [x] Unit test: Malformed AI response shows retry option
- [x] Unit test: Long titles are truncated with ellipsis
- [x] Unit test: Special characters don't break rendering

**Implementation Notes:**
- **Server-side validation**: Added `Validate()` method to `GeneratedChecklist` in `ai_service.go`. Filters out items with empty titles, sections with no valid items, and provides default titles when missing.
- **Sentinel errors**: Added `ErrEmptyChecklist` and `ErrMalformedResponse` for specific error handling. `ErrEmptyChecklist` is returned when AI finds no actionable items.
- **CSS truncation**: Section titles use single-line ellipsis (`text-overflow: ellipsis`). Item titles use 2-line clamp, descriptions use 3-line clamp via `-webkit-line-clamp`.
- **Long strings**: Uses `overflow-wrap: anywhere` to break long unbroken strings (URLs, code) at any point.
- **Empty sections**: `QuicklistSection` component returns `null` for sections with empty/undefined items array.
- **Special characters**: React handles HTML escaping automatically. No additional sanitization needed at display layer.

**Phase 4 Deliverable:** Production-ready feature with robust error handling.

---

## Phase 5: Documentation & Release

### 5.1 Documentation

**Tasks:**
- [x] Add admin documentation for configuration
- [x] Add user documentation for `/playbook quicklist` command
- [x] Document required mattermost-plugin-agents setup
- [x] Add troubleshooting guide

**Implementation Notes:**
- Documentation created at `docs/quicklists.md` with combined user and admin sections
- README.md updated with Features section linking to the documentation
- Agents plugin setup documented as a prerequisite with reference to the plugin's own documentation

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
| Phase 4 | ~10 | 1 | 0 | 4 |
| **Total** | **~45** | **6** | **2** | **7** |

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
