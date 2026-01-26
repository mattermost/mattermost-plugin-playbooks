// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
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
	if err := json.Unmarshal([]byte(response), &checklist); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w", err)
	}

	return &checklist, nil
}
