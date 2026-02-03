// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// Default prompts for quicklist generation.
const defaultQuicklistSystemPrompt = `You are an assistant that analyzes conversation threads and extracts actionable tasks into a structured checklist.

Your output must be valid JSON with this structure:
{
    "title": "Brief descriptive title for the checklist",
    "sections": [
        {
            "title": "Section name (group related tasks)",
            "items": [
                {
                    "title": "Task title (action-oriented, starts with verb)",
                    "description": "Additional context or details",
                    "due_date": "YYYY-MM-DD or empty string if not mentioned"
                }
            ]
        }
    ]
}

Guidelines:
- Extract concrete, actionable tasks only
- Group related tasks into logical sections (2-5 sections ideal)
- Use action verbs for task titles (Create, Review, Update, etc.)
- Include due dates only when explicitly mentioned or clearly implied
- Keep descriptions concise but informative
- Ignore casual conversation, focus on commitments and action items
- If someone says they will do something, that's a task
- If a question is asked that needs resolution, that's a task
- Limit to 20 items total to keep the checklist manageable`

const defaultQuicklistUserPrompt = `Analyze the following thread and extract all actionable tasks into a structured checklist.

%s

Return only valid JSON, no additional text.`

// QuicklistGenerateRequest represents a request to generate a checklist from thread content.
type QuicklistGenerateRequest struct {
	ThreadContent string
	ChannelID     string
	UserID        string
}

// QuicklistRefineRequest represents a request to refine an existing checklist based on feedback.
type QuicklistRefineRequest struct {
	ThreadContent     string
	ChannelID         string
	UserID            string
	CurrentChecklists []Checklist
	Feedback          string
}

// GeneratedChecklist is the AI response structure containing a title and sections.
type GeneratedChecklist struct {
	Title    string             `json:"title"`
	Sections []GeneratedSection `json:"sections"`
}

// GeneratedSection represents a group of related tasks.
type GeneratedSection struct {
	Title string          `json:"title"`
	Items []GeneratedItem `json:"items"`
}

// GeneratedItem represents a single actionable task from the AI.
type GeneratedItem struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	DueDate     string `json:"due_date"`
}

// ToChecklists converts the AI-generated checklist to the Playbooks Checklist format.
func (g *GeneratedChecklist) ToChecklists() []Checklist {
	checklists := make([]Checklist, 0, len(g.Sections))

	for _, section := range g.Sections {
		checklist := Checklist{
			ID:    model.NewId(),
			Title: section.Title,
		}

		for _, item := range section.Items {
			checklistItem := ChecklistItem{
				ID:          model.NewId(),
				Title:       item.Title,
				Description: item.Description,
				State:       "",
				DueDate:     parseDueDate(item.DueDate),
			}
			checklist.Items = append(checklist.Items, checklistItem)
			checklist.ItemsOrder = append(checklist.ItemsOrder, checklistItem.ID)
		}

		checklists = append(checklists, checklist)
	}

	return checklists
}

// ErrEmptyChecklist indicates the AI returned no actionable items.
var ErrEmptyChecklist = fmt.Errorf("no action items could be identified in the thread")

// ErrMalformedResponse indicates the AI returned invalid or incomplete data.
var ErrMalformedResponse = fmt.Errorf("AI returned malformed response")

// Validate checks the generated checklist for completeness and correctness.
// Returns ErrEmptyChecklist if no actionable items were found.
// Returns ErrMalformedResponse if the response is structurally invalid.
func (g *GeneratedChecklist) Validate() error {
	// Check for completely empty response
	if g == nil {
		return ErrMalformedResponse
	}

	// Filter out sections with no valid items
	validSections := make([]GeneratedSection, 0, len(g.Sections))
	for _, section := range g.Sections {
		// Filter items with empty titles
		validItems := make([]GeneratedItem, 0, len(section.Items))
		for _, item := range section.Items {
			if strings.TrimSpace(item.Title) != "" {
				validItems = append(validItems, item)
			}
		}

		// Only include section if it has valid items
		if len(validItems) > 0 {
			section.Items = validItems
			// Use section title or provide default if missing
			if strings.TrimSpace(section.Title) == "" {
				section.Title = "Tasks"
			}
			validSections = append(validSections, section)
		}
	}

	// Update sections to only valid ones
	g.Sections = validSections

	// If no valid sections remain, the checklist is empty
	if len(g.Sections) == 0 {
		return ErrEmptyChecklist
	}

	// Provide default title if missing
	if strings.TrimSpace(g.Title) == "" {
		g.Title = "Checklist from Thread"
	}

	return nil
}

// parseDueDate converts an ISO 8601 date string (YYYY-MM-DD) to Unix timestamp in milliseconds.
// Returns 0 if dateStr is empty or invalid.
func parseDueDate(dateStr string) int64 {
	if dateStr == "" {
		return 0
	}

	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return 0
	}

	return t.UnixMilli()
}

// BridgeClient is an interface for the AI bridge client to allow for mocking in tests.
type BridgeClient interface {
	GetAgents(userID string) ([]bridgeclient.BridgeAgentInfo, error)
	AgentCompletion(agent string, request bridgeclient.CompletionRequest) (string, error)
}

// AIService provides methods for AI-powered features using the bridge client.
type AIService struct {
	bridgeClient BridgeClient
	config       config.Service
}

// NewAIService creates a new AIService instance.
func NewAIService(bridgeClient BridgeClient, config config.Service) *AIService {
	return &AIService{
		bridgeClient: bridgeClient,
		config:       config,
	}
}

// IsAvailable checks if the AI agents plugin is running and accessible.
func (s *AIService) IsAvailable() error {
	_, err := s.bridgeClient.GetAgents("")
	if err != nil {
		return fmt.Errorf("AI plugin not available: %w", err)
	}
	return nil
}

// GenerateChecklist generates a checklist from thread content using AI.
func (s *AIService) GenerateChecklist(req QuicklistGenerateRequest) (*GeneratedChecklist, error) {
	cfg := s.config.GetConfiguration()

	if cfg.QuicklistAgentBotID == "" {
		return nil, fmt.Errorf("quicklist agent not configured")
	}

	// Use configured prompts or fall back to defaults
	systemPrompt := cfg.QuicklistSystemPrompt
	if systemPrompt == "" {
		systemPrompt = defaultQuicklistSystemPrompt
	}

	userPrompt := cfg.QuicklistUserPrompt
	if userPrompt == "" {
		userPrompt = defaultQuicklistUserPrompt
	}

	response, err := s.bridgeClient.AgentCompletion(cfg.QuicklistAgentBotID, bridgeclient.CompletionRequest{
		UserID:    req.UserID,
		ChannelID: req.ChannelID,
		Posts: []bridgeclient.Post{
			{Role: "system", Message: systemPrompt},
			{Role: "user", Message: fmt.Sprintf(userPrompt, req.ThreadContent)},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("AI completion failed: %w", err)
	}

	var checklist GeneratedChecklist
	cleanedResponse := stripMarkdownCodeFences(response)
	if err := json.Unmarshal([]byte(cleanedResponse), &checklist); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w", err)
	}

	// Validate and sanitize the generated checklist
	if err := checklist.Validate(); err != nil {
		return nil, err
	}

	return &checklist, nil
}

// stripMarkdownCodeFences removes markdown code fence wrappers from AI responses.
// LLMs often wrap JSON in ```json ... ``` even when asked not to.
func stripMarkdownCodeFences(s string) string {
	s = strings.TrimSpace(s)
	// Strip ```json or ``` prefix
	if after, found := strings.CutPrefix(s, "```json"); found {
		s = after
	} else if after, found := strings.CutPrefix(s, "```"); found {
		s = after
	}
	// Strip trailing ```
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

// Default refinement prompt template.
const defaultQuicklistRefinePrompt = `The user has provided feedback on the checklist. Please update the checklist based on their feedback.

User feedback: %s

Return the updated checklist in the same JSON format. Only modify what the user requested. Keep all other items unchanged unless they conflict with the feedback.`

// RefineChecklist refines an existing checklist based on user feedback using AI.
func (s *AIService) RefineChecklist(req QuicklistRefineRequest) (*GeneratedChecklist, error) {
	cfg := s.config.GetConfiguration()

	if cfg.QuicklistAgentBotID == "" {
		return nil, fmt.Errorf("quicklist agent not configured")
	}

	// Use configured prompts or fall back to defaults
	systemPrompt := cfg.QuicklistSystemPrompt
	if systemPrompt == "" {
		systemPrompt = defaultQuicklistSystemPrompt
	}

	userPrompt := cfg.QuicklistUserPrompt
	if userPrompt == "" {
		userPrompt = defaultQuicklistUserPrompt
	}

	// Convert current checklists to AI format for context
	previousResponse := checklistsToGeneratedJSON(req.CurrentChecklists)

	// Build refinement prompt
	refinementPrompt := fmt.Sprintf(defaultQuicklistRefinePrompt, req.Feedback)

	// Build conversation with context: system, original request, previous response, feedback
	response, err := s.bridgeClient.AgentCompletion(cfg.QuicklistAgentBotID, bridgeclient.CompletionRequest{
		UserID:    req.UserID,
		ChannelID: req.ChannelID,
		Posts: []bridgeclient.Post{
			{Role: "system", Message: systemPrompt},
			{Role: "user", Message: fmt.Sprintf(userPrompt, req.ThreadContent)},
			{Role: "assistant", Message: previousResponse},
			{Role: "user", Message: refinementPrompt},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("AI completion failed: %w", err)
	}

	var checklist GeneratedChecklist
	cleanedResponse := stripMarkdownCodeFences(response)
	if err := json.Unmarshal([]byte(cleanedResponse), &checklist); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w", err)
	}

	// Validate and sanitize the generated checklist
	if err := checklist.Validate(); err != nil {
		return nil, err
	}

	return &checklist, nil
}

// checklistsToGeneratedJSON converts Playbooks checklists back to the AI response format for context.
func checklistsToGeneratedJSON(checklists []Checklist) string {
	generated := GeneratedChecklist{
		Title:    "", // Title will be inferred from context
		Sections: make([]GeneratedSection, 0, len(checklists)),
	}

	for _, cl := range checklists {
		section := GeneratedSection{
			Title: cl.Title,
			Items: make([]GeneratedItem, 0, len(cl.Items)),
		}

		for _, item := range cl.Items {
			genItem := GeneratedItem{
				Title:       item.Title,
				Description: item.Description,
				DueDate:     formatDueDate(item.DueDate),
			}
			section.Items = append(section.Items, genItem)
		}

		generated.Sections = append(generated.Sections, section)
	}

	// Marshal to JSON for AI context
	jsonBytes, err := json.Marshal(generated)
	if err != nil {
		// Return empty JSON on error - AI will regenerate from thread
		return "{}"
	}

	return string(jsonBytes)
}

// formatDueDate converts Unix timestamp in milliseconds back to ISO 8601 date string.
// Returns empty string if timestamp is 0.
func formatDueDate(timestamp int64) string {
	if timestamp == 0 {
		return ""
	}

	t := time.UnixMilli(timestamp)
	return t.Format("2006-01-02")
}
