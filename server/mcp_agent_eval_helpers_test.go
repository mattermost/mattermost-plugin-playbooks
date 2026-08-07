// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/mattermost/mattermost-plugin-agents/public/bridgeclient"
	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/modelcontextprotocol/go-sdk/mcp"

	pbtools "github.com/mattermost/mattermost-plugin-playbooks/internal/playbooksmcp/tools"
)

const (
	evalMaxIterations   = 15
	evalMaxTokens       = 4096
	evalLLMMaxRetries   = 3
	evalToolResultLimit = 8000

	anthropicMessagesURL = "https://api.anthropic.com/v1/messages"
	anthropicVersion     = "2023-06-01"
	openAIChatURL        = "https://api.openai.com/v1/chat/completions"
)

// evalSystemPrompt mirrors the context the Mattermost Agents plugin puts in
// front of an LLM: who is asking, and where they are asking from.
func evalSystemPrompt(username, userID, teamName, teamID, channelName, channelID string) string {
	return fmt.Sprintf(
		"You are an AI assistant inside Mattermost. You are chatting with @%s (user ID %s). "+
			"Current team: %s (ID %s). Current channel: %s (ID %s). "+
			"Use the available tools to fulfill the user's request. Take actions directly when the "+
			"request is clear; if the request is truly ambiguous, say so. When finished, reply with a "+
			"concise summary of what you did.",
		username, userID, teamName, teamID, channelName, channelID)
}

// --- APIClient over real HTTP -------------------------------------------------

// evalAPIClient implements internal/playbooksmcp/tools.APIClient by talking to
// the plugin's REST API over real HTTP as a specific user. Its error strings
// mirror pluginMCPClient.do in server/mcp.go so the model sees the same text it
// would in production.
type evalAPIClient struct {
	baseURL string
	token   string
	userID  string
	siteURL string
	client  *http.Client
}

func newEvalAPIClient(serverURL, token, userID string) *evalAPIClient {
	base := strings.TrimRight(serverURL, "/")
	return &evalAPIClient{
		baseURL: base + "/plugins/" + manifest.Id + "/api/v0/",
		token:   token,
		userID:  userID,
		siteURL: base,
		client:  &http.Client{Timeout: 60 * time.Second},
	}
}

func (c *evalAPIClient) Get(ctx context.Context, endpoint string, params url.Values, result any) error {
	if len(params) > 0 {
		endpoint += "?" + params.Encode()
	}
	return c.do(ctx, http.MethodGet, endpoint, nil, result)
}

func (c *evalAPIClient) Post(ctx context.Context, endpoint string, body any, result any) error {
	return c.do(ctx, http.MethodPost, endpoint, body, result)
}

func (c *evalAPIClient) Put(ctx context.Context, endpoint string, body any, result any) error {
	return c.do(ctx, http.MethodPut, endpoint, body, result)
}

func (c *evalAPIClient) Patch(ctx context.Context, endpoint string, body any, result any) error {
	return c.do(ctx, http.MethodPatch, endpoint, body, result)
}

func (c *evalAPIClient) Delete(ctx context.Context, endpoint string) error {
	return c.do(ctx, http.MethodDelete, endpoint, nil, nil)
}

func (c *evalAPIClient) GetCurrentUserID(context.Context) (string, error) {
	if c.userID == "" {
		return "", fmt.Errorf("missing Mattermost user ID")
	}
	return c.userID, nil
}

func (c *evalAPIClient) GetPlaybookURL(playbookID string) string {
	return c.siteURL + "/playbooks/playbooks/" + playbookID
}

// GetRunURL and Patch are implemented unconditionally so this harness compiles
// against both the baseline tools.APIClient and the widened one.
func (c *evalAPIClient) GetRunURL(runID string) string {
	return c.siteURL + "/playbooks/runs/" + runID
}

// ResolveUserID mirrors pluginMCPClient.ResolveUserID in server/mcp.go, so an
// eval sees the same handling of "me", raw IDs, and usernames that production
// gives. The username lookup goes to the core API as the acting user.
func (c *evalAPIClient) ResolveUserID(ctx context.Context, userRef string) (string, error) {
	ref := strings.TrimSpace(userRef)
	if ref == "" {
		return "", fmt.Errorf(`a user reference is required: pass a user ID, "me", or a username such as "@bob"`)
	}
	if ref == "me" {
		return c.GetCurrentUserID(ctx)
	}
	if model.IsValidId(ref) {
		return ref, nil
	}
	username := strings.ToLower(strings.TrimPrefix(ref, "@"))
	c4 := model.NewAPIv4Client(c.siteURL)
	c4.SetToken(c.token)
	user, _, err := c4.GetUserByUsername(ctx, username, "")
	if err != nil {
		return "", fmt.Errorf("no user found with username %q — check the spelling (usernames are case-insensitive, without the @). Underlying error: %w", username, err)
	}
	return user.Id, nil
}

func (c *evalAPIClient) do(ctx context.Context, method, endpoint string, body any, result any) error {
	var r io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		r = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+strings.TrimLeft(endpoint, "/"), r)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, rerr := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
		if rerr != nil {
			return fmt.Errorf("API error (status %d); failed to read response body: %w", resp.StatusCode, rerr)
		}
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(data))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
		return nil
	}
	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("failed to drain response body: %w", err)
	}
	return nil
}

// --- MCP session --------------------------------------------------------------

type evalTool struct {
	Name        string
	Description string
	Schema      map[string]any
}

// evalMCPHarness is an in-process MCP server for the Playbooks tools, fronted by
// an httptest server that injects the two headers mcphelper authenticates on.
type evalMCPHarness struct {
	httpServer *httptest.Server
	session    *mcp.ClientSession
	Tools      []evalTool
}

func newEvalMCPHarness(ctx context.Context, actingUserID string, factory pbtools.ClientFactory) (*evalMCPHarness, error) {
	provider, err := pbtools.NewPlaybooksToolProvider(factory)
	if err != nil {
		return nil, fmt.Errorf("failed to create tool provider: %w", err)
	}

	helperServer := mcphelper.NewServer(nil, mcphelper.PluginMCPServer{
		PluginID: manifest.Id,
		Name:     "Playbooks MCP",
		Path:     playbooksMCPEndpoint,
		Version:  manifest.Version,
	})
	provider.ProvideMCPHelperTools(helperServer)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Header.Set("Mattermost-Plugin-ID", bridgeclient.AiPluginID)
		r.Header.Set("X-Mattermost-UserID", actingUserID)
		helperServer.ServeHTTP(w, r)
	}))

	mcpClient := mcp.NewClient(&mcp.Implementation{Name: "playbooks-agent-eval", Version: "0.0.1"}, nil)
	session, err := mcpClient.Connect(ctx, &mcp.StreamableClientTransport{Endpoint: ts.URL}, nil)
	if err != nil {
		ts.Close()
		return nil, fmt.Errorf("failed to connect MCP client: %w", err)
	}

	listed, err := session.ListTools(ctx, nil)
	if err != nil {
		_ = session.Close()
		ts.Close()
		return nil, fmt.Errorf("ListTools failed: %w", err)
	}

	harness := &evalMCPHarness{httpServer: ts, session: session}
	for _, tool := range listed.Tools {
		schema, serr := normalizeToolSchema(tool.InputSchema)
		if serr != nil {
			_ = session.Close()
			ts.Close()
			return nil, fmt.Errorf("failed to normalize schema for %s: %w", tool.Name, serr)
		}
		harness.Tools = append(harness.Tools, evalTool{
			Name:        tool.Name,
			Description: tool.Description,
			Schema:      schema,
		})
	}
	sort.Slice(harness.Tools, func(i, j int) bool { return harness.Tools[i].Name < harness.Tools[j].Name })
	return harness, nil
}

func (h *evalMCPHarness) Close() {
	if h == nil {
		return
	}
	if h.session != nil {
		_ = h.session.Close()
	}
	if h.httpServer != nil {
		h.httpServer.Close()
	}
}

// CallTool executes an MCP tool and returns its text output plus whether the
// tool reported an error. Tool errors are returned to the model as text, which
// is how a real agent sees them.
func (h *evalMCPHarness) CallTool(ctx context.Context, name string, rawArgs json.RawMessage) (string, bool) {
	args := map[string]any{}
	trimmed := strings.TrimSpace(string(rawArgs))
	if trimmed != "" && trimmed != "null" {
		if err := json.Unmarshal([]byte(trimmed), &args); err != nil {
			return fmt.Sprintf("invalid tool arguments: %v", err), true
		}
	}

	result, err := h.session.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: args})
	if err != nil {
		return fmt.Sprintf("tool call failed: %v", err), true
	}

	var sb strings.Builder
	for _, content := range result.Content {
		if text, ok := content.(*mcp.TextContent); ok {
			sb.WriteString(text.Text)
		}
	}
	out := sb.String()
	if out == "" {
		out = "(no output)"
	}
	return truncateForModel(out, evalToolResultLimit), result.IsError
}

// normalizeToolSchema round-trips the schema through JSON so it is a plain map,
// and drops $schema which some provider APIs reject.
func normalizeToolSchema(schema any) (map[string]any, error) {
	if schema == nil {
		return map[string]any{"type": "object", "properties": map[string]any{}}, nil
	}
	data, err := json.Marshal(schema)
	if err != nil {
		return nil, err
	}
	out := map[string]any{}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	delete(out, "$schema")
	if _, ok := out["type"]; !ok {
		out["type"] = "object"
	}
	if _, ok := out["properties"]; !ok {
		out["properties"] = map[string]any{}
	}
	return out, nil
}

func truncateForModel(s string, limit int) string {
	if len(s) <= limit {
		return s
	}
	return s[:limit] + fmt.Sprintf("\n… (truncated, %d more characters)", len(s)-limit)
}

// --- Transcript ---------------------------------------------------------------

type evalToolCall struct {
	Iteration int
	Name      string
	Args      string
	Result    string
	IsError   bool
}

type evalTranscriptStep struct {
	Iteration int
	Kind      string // "assistant_text", "tool_use", "tool_result", "error"
	Name      string
	Text      string
}

type evalTranscript struct {
	Scenario  string
	Provider  string
	Model     string
	System    string
	Prompt    string
	Steps     []evalTranscriptStep
	ToolCalls []evalToolCall
	FinalText string
	RunErr    error
	Duration  time.Duration
}

func (tr *evalTranscript) addStep(iteration int, kind, name, text string) {
	tr.Steps = append(tr.Steps, evalTranscriptStep{Iteration: iteration, Kind: kind, Name: name, Text: text})
}

func (tr *evalTranscript) addToolCall(iteration int, name, args, result string, isError bool) {
	tr.ToolCalls = append(tr.ToolCalls, evalToolCall{Iteration: iteration, Name: name, Args: args, Result: result, IsError: isError})
	tr.addStep(iteration, "tool_use", name, args)
	kind := "tool_result"
	if isError {
		kind = "tool_error"
	}
	tr.addStep(iteration, kind, name, result)
}

// ToolNames returns the distinct tools called, in first-call order.
func (tr *evalTranscript) ToolNames() []string {
	seen := map[string]bool{}
	var names []string
	for _, call := range tr.ToolCalls {
		if seen[call.Name] {
			continue
		}
		seen[call.Name] = true
		names = append(names, call.Name)
	}
	return names
}

func (tr *evalTranscript) Called(name string) bool {
	for _, call := range tr.ToolCalls {
		if call.Name == name || call.Name == "playbooks__"+name {
			return true
		}
	}
	return false
}

// CallArgs returns the raw JSON arguments of every call to a tool, so a
// scenario can assert on what the model actually passed (bare tool name or
// playbooks__-prefixed both match).
func (tr *evalTranscript) CallArgs(name string) []string {
	var args []string
	for _, call := range tr.ToolCalls {
		if call.Name == name || call.Name == "playbooks__"+name {
			args = append(args, call.Args)
		}
	}
	return args
}

// ToolErrors returns the text of every tool call the MCP server rejected.
func (tr *evalTranscript) ToolErrors() []evalToolCall {
	var errs []evalToolCall
	for _, call := range tr.ToolCalls {
		if call.IsError {
			errs = append(errs, call)
		}
	}
	return errs
}

// evalLimitationPatterns match an assistant saying the capability is missing.
// They deliberately require a capability noun near the negation so that ordinary
// hedging ("I could not find the run yet") does not count as a refusal.
var evalLimitationPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(cannot|can't|can not|couldn't|could not|unable to|not able to)\b`),
	regexp.MustCompile(`(?i)\b(don't|do not|doesn't|does not|didn't|did not)\b[^.\n]{0,70}\b(tool|api|endpoint|support|expose|function|capabilit|permission|way|option|method|action)`),
	regexp.MustCompile(`(?i)\b(there (is|'s) no|there are no|isn't (a|an|any)|is not (a|an|any)|no (direct )?(tool|way|api|endpoint|method|option|function))\b`),
	regexp.MustCompile(`(?i)\bnot (currently )?(supported|possible|available|exposed|implemented|offered)\b`),
	regexp.MustCompile(`(?i)\b(you'll|you will|you) (need to|have to|can) .{0,40}\b(ui|web app|interface|manually)\b`),
	regexp.MustCompile(`(?i)\b(available tools?|tools? (available|here|i have)|tools? i have access to)\b[^.\n]{0,80}\b(only|not|cannot|can't)\b`),
	// Handing the request back to the user for missing input is also an honest
	// non-completion: the user knows the task did not happen.
	regexp.MustCompile(`(?i)\b(could|can|would) you\b[^.\n]{0,40}\b(provide|give|share|tell me|confirm|send)\b`),
	regexp.MustCompile(`(?i)\bi('ll)? (need|require|would need)\b[^.\n]{0,60}\b(id|identifier|name|value|permission)\b`),
}

// DisclosedLimitation reports whether the assistant told the user it could not
// do (all of) what was asked. Used to separate an honest refusal from a silent
// failure or a hallucinated success.
func (tr *evalTranscript) DisclosedLimitation() bool {
	text := tr.FinalText
	for _, step := range tr.Steps {
		if step.Kind == "assistant_text" {
			text += "\n" + step.Text
		}
	}
	text = normalizeApostrophes(text)
	for _, pattern := range evalLimitationPatterns {
		if pattern.MatchString(text) {
			return true
		}
	}
	return false
}

// normalizeApostrophes folds the typographic apostrophes models like to emit
// ("don’t") onto ASCII so the refusal patterns match either spelling.
func normalizeApostrophes(s string) string {
	return strings.NewReplacer("\u2019", "'", "\u2018", "'", "\u02bc", "'").Replace(s)
}

// --- LLM agent loop -----------------------------------------------------------

type evalToolExecutor func(ctx context.Context, name string, args json.RawMessage) (string, bool)

var evalLLMHTTPClient = &http.Client{Timeout: 10 * time.Minute}

func postJSONWithRetry(ctx context.Context, endpoint string, headers map[string]string, payload any) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt <= evalLLMMaxRetries; attempt++ {
		if attempt > 0 {
			delay := time.Duration(1<<uint(attempt-1)) * 2 * time.Second
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}

		req, rerr := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
		if rerr != nil {
			return nil, fmt.Errorf("failed to create request: %w", rerr)
		}
		req.Header.Set("Content-Type", "application/json")
		for k, v := range headers {
			req.Header.Set(k, v)
		}

		resp, derr := evalLLMHTTPClient.Do(req)
		if derr != nil {
			lastErr = derr
			continue
		}
		data, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			continue
		}

		switch {
		case resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500:
			lastErr = fmt.Errorf("LLM API error (status %d): %s", resp.StatusCode, truncateForModel(string(data), 500))
			continue
		case resp.StatusCode >= 400:
			return nil, fmt.Errorf("LLM API error (status %d): %s", resp.StatusCode, truncateForModel(string(data), 2000))
		}
		return data, nil
	}
	return nil, fmt.Errorf("LLM request failed after %d attempts: %w", evalLLMMaxRetries+1, lastErr)
}

type evalAgent interface {
	Provider() string
	Model() string
	Run(ctx context.Context, system, prompt string, tools []evalTool, exec evalToolExecutor, tr *evalTranscript) error
}

// --- Anthropic ----------------------------------------------------------------

type anthropicAgent struct {
	apiKey string
	model  string
}

func (a *anthropicAgent) Provider() string { return "anthropic" }
func (a *anthropicAgent) Model() string    { return a.model }

type anthropicBlock struct {
	Type  string          `json:"type"`
	Text  string          `json:"text"`
	ID    string          `json:"id"`
	Name  string          `json:"name"`
	Input json.RawMessage `json:"input"`
}

type anthropicResponse struct {
	Content    []json.RawMessage `json:"content"`
	StopReason string            `json:"stop_reason"`
}

func (a *anthropicAgent) Run(ctx context.Context, system, prompt string, tools []evalTool, exec evalToolExecutor, tr *evalTranscript) error {
	apiTools := make([]map[string]any, 0, len(tools))
	for _, tool := range tools {
		apiTools = append(apiTools, map[string]any{
			"name":         tool.Name,
			"description":  tool.Description,
			"input_schema": tool.Schema,
		})
	}

	headers := map[string]string{
		"x-api-key":         a.apiKey,
		"anthropic-version": anthropicVersion,
	}

	messages := []any{map[string]any{"role": "user", "content": prompt}}

	for iteration := 1; iteration <= evalMaxIterations; iteration++ {
		payload := map[string]any{
			"model":      a.model,
			"max_tokens": evalMaxTokens,
			"system":     system,
			"tools":      apiTools,
			"messages":   messages,
		}

		data, err := postJSONWithRetry(ctx, anthropicMessagesURL, headers, payload)
		if err != nil {
			return err
		}

		var resp anthropicResponse
		if err := json.Unmarshal(data, &resp); err != nil {
			return fmt.Errorf("failed to decode Anthropic response: %w", err)
		}

		// Rebuild the assistant turn from the blocks we understand rather than
		// echoing the response verbatim, so provider-added fields can't make the
		// next request invalid.
		var assistantBlocks []any
		var toolResults []any
		lastText := ""

		for _, raw := range resp.Content {
			var block anthropicBlock
			if err := json.Unmarshal(raw, &block); err != nil {
				continue
			}
			switch block.Type {
			case "text":
				if strings.TrimSpace(block.Text) == "" {
					continue
				}
				lastText = block.Text
				tr.addStep(iteration, "assistant_text", "", block.Text)
				assistantBlocks = append(assistantBlocks, map[string]any{"type": "text", "text": block.Text})
			case "tool_use":
				input := block.Input
				if len(input) == 0 {
					input = json.RawMessage("{}")
				}
				assistantBlocks = append(assistantBlocks, map[string]any{
					"type":  "tool_use",
					"id":    block.ID,
					"name":  block.Name,
					"input": input,
				})
				result, isError := exec(ctx, block.Name, input)
				tr.addToolCall(iteration, block.Name, string(input), result, isError)
				toolResults = append(toolResults, map[string]any{
					"type":        "tool_result",
					"tool_use_id": block.ID,
					"content":     result,
					"is_error":    isError,
				})
			}
		}

		if len(toolResults) == 0 {
			tr.FinalText = lastText
			return nil
		}
		if len(assistantBlocks) == 0 {
			return fmt.Errorf("anthropic returned tool results with no usable assistant blocks")
		}

		messages = append(messages,
			map[string]any{"role": "assistant", "content": assistantBlocks},
			map[string]any{"role": "user", "content": toolResults})

		if lastText != "" {
			tr.FinalText = lastText
		}
	}

	return fmt.Errorf("agent did not finish within %d iterations", evalMaxIterations)
}

// --- OpenAI -------------------------------------------------------------------

type openAIAgent struct {
	apiKey string
	model  string
}

func (o *openAIAgent) Provider() string { return "openai" }
func (o *openAIAgent) Model() string    { return o.model }

type openAIToolCall struct {
	ID       string `json:"id"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content   *string          `json:"content"`
			ToolCalls []openAIToolCall `json:"tool_calls"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
}

func (o *openAIAgent) Run(ctx context.Context, system, prompt string, tools []evalTool, exec evalToolExecutor, tr *evalTranscript) error {
	apiTools := make([]map[string]any, 0, len(tools))
	for _, tool := range tools {
		apiTools = append(apiTools, map[string]any{
			"type": "function",
			"function": map[string]any{
				"name":        tool.Name,
				"description": tool.Description,
				"parameters":  tool.Schema,
			},
		})
	}

	headers := map[string]string{"Authorization": "Bearer " + o.apiKey}

	messages := []json.RawMessage{}
	appendMessage := func(v any) error {
		raw, err := json.Marshal(v)
		if err != nil {
			return err
		}
		messages = append(messages, raw)
		return nil
	}
	if err := appendMessage(map[string]any{"role": "system", "content": system}); err != nil {
		return err
	}
	if err := appendMessage(map[string]any{"role": "user", "content": prompt}); err != nil {
		return err
	}

	for iteration := 1; iteration <= evalMaxIterations; iteration++ {
		payload := map[string]any{
			"model":                 o.model,
			"max_completion_tokens": evalMaxTokens,
			"tools":                 apiTools,
			"messages":              messages,
		}

		data, err := postJSONWithRetry(ctx, openAIChatURL, headers, payload)
		if err != nil {
			return err
		}

		// Keep the assistant message exactly as returned; the Chat Completions
		// API round-trips provider-specific fields on later turns.
		var rawResp struct {
			Choices []struct {
				Message json.RawMessage `json:"message"`
			} `json:"choices"`
		}
		if err := json.Unmarshal(data, &rawResp); err != nil {
			return fmt.Errorf("failed to decode OpenAI response: %w", err)
		}
		var resp openAIResponse
		if err := json.Unmarshal(data, &resp); err != nil {
			return fmt.Errorf("failed to decode OpenAI response: %w", err)
		}
		if len(resp.Choices) == 0 || len(rawResp.Choices) == 0 {
			return fmt.Errorf("openai returned no choices: %s", truncateForModel(string(data), 500))
		}

		message := resp.Choices[0].Message
		if message.Content != nil && strings.TrimSpace(*message.Content) != "" {
			tr.addStep(iteration, "assistant_text", "", *message.Content)
			tr.FinalText = *message.Content
		}

		if len(message.ToolCalls) == 0 {
			if message.Content != nil {
				tr.FinalText = *message.Content
			}
			return nil
		}

		messages = append(messages, rawResp.Choices[0].Message)

		for _, call := range message.ToolCalls {
			args := json.RawMessage(call.Function.Arguments)
			if strings.TrimSpace(call.Function.Arguments) == "" {
				args = json.RawMessage("{}")
			}
			result, isError := exec(ctx, call.Function.Name, args)
			tr.addToolCall(iteration, call.Function.Name, string(args), result, isError)
			if err := appendMessage(map[string]any{
				"role":         "tool",
				"tool_call_id": call.ID,
				"content":      result,
			}); err != nil {
				return err
			}
		}
	}

	return fmt.Errorf("agent did not finish within %d iterations", evalMaxIterations)
}

// --- Transcript output --------------------------------------------------------

type evalResult struct {
	Scenario  string
	Outcome   string
	ToolNames []string
	Notes     []string
	Duration  time.Duration
}

func writeEvalTranscript(dir string, tr *evalTranscript, res *evalResult) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "# %s — %s\n\n", tr.Scenario, tr.Provider)
	fmt.Fprintf(&sb, "- Model: `%s`\n", tr.Model)
	fmt.Fprintf(&sb, "- Outcome: **%s**\n", res.Outcome)
	fmt.Fprintf(&sb, "- Duration: %s\n", tr.Duration.Round(time.Millisecond))
	fmt.Fprintf(&sb, "- Tools called: %s\n", formatToolList(res.ToolNames))
	if len(res.Notes) > 0 {
		sb.WriteString("- Notes:\n")
		for _, note := range res.Notes {
			fmt.Fprintf(&sb, "  - %s\n", note)
		}
	}
	if tr.RunErr != nil {
		fmt.Fprintf(&sb, "- Agent loop error: `%s`\n", tr.RunErr)
	}

	sb.WriteString("\n## System prompt\n\n```\n" + tr.System + "\n```\n")
	sb.WriteString("\n## User prompt\n\n```\n" + tr.Prompt + "\n```\n")

	sb.WriteString("\n## Conversation\n")
	for _, step := range tr.Steps {
		switch step.Kind {
		case "assistant_text":
			fmt.Fprintf(&sb, "\n### [%d] assistant\n\n%s\n", step.Iteration, step.Text)
		case "tool_use":
			fmt.Fprintf(&sb, "\n### [%d] tool call → `%s`\n\n```json\n%s\n```\n", step.Iteration, step.Name, prettyJSON(step.Text))
		case "tool_result":
			fmt.Fprintf(&sb, "\n### [%d] tool result ← `%s`\n\n```\n%s\n```\n", step.Iteration, step.Name, step.Text)
		case "tool_error":
			fmt.Fprintf(&sb, "\n### [%d] tool ERROR ← `%s`\n\n```\n%s\n```\n", step.Iteration, step.Name, step.Text)
		default:
			fmt.Fprintf(&sb, "\n### [%d] %s\n\n%s\n", step.Iteration, step.Kind, step.Text)
		}
	}

	sb.WriteString("\n## Final answer\n\n")
	if tr.FinalText == "" {
		sb.WriteString("_(none)_\n")
	} else {
		sb.WriteString(tr.FinalText + "\n")
	}

	return os.WriteFile(filepath.Join(dir, tr.Scenario+".md"), []byte(sb.String()), 0o644)
}

func writeEvalSummary(path, provider, model string, results []*evalResult) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	counts := map[string]int{}
	for _, res := range results {
		counts[res.Outcome]++
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "# Playbooks MCP agent eval — %s\n\n", provider)
	fmt.Fprintf(&sb, "Model: `%s`\n\n", model)
	fmt.Fprintf(&sb, "PASS %d · PARTIAL %d · FAIL %d · ERROR %d (of %d)\n\n",
		counts["PASS"], counts["PARTIAL"], counts["FAIL"], counts["ERROR"], len(results))
	sb.WriteString("| scenario | outcome | tools called | notes |\n|---|---|---|---|\n")
	for _, res := range results {
		notes := strings.Join(res.Notes, "; ")
		notes = strings.ReplaceAll(notes, "|", "\\|")
		notes = strings.ReplaceAll(notes, "\n", " ")
		fmt.Fprintf(&sb, "| %s | %s | %s | %s |\n",
			res.Scenario, res.Outcome, formatToolList(res.ToolNames), notes)
	}
	return os.WriteFile(path, []byte(sb.String()), 0o644)
}

func formatToolList(names []string) string {
	if len(names) == 0 {
		return "_(none)_"
	}
	trimmed := make([]string, 0, len(names))
	for _, name := range names {
		trimmed = append(trimmed, "`"+strings.TrimPrefix(name, "playbooks__")+"`")
	}
	return strings.Join(trimmed, ", ")
}

func prettyJSON(raw string) string {
	var buf bytes.Buffer
	if err := json.Indent(&buf, []byte(raw), "", "  "); err != nil {
		return raw
	}
	return buf.String()
}
