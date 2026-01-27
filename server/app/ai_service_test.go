// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// mockBridgeClient is a mock implementation of BridgeClient for testing.
type mockBridgeClient struct {
	getAgentsFunc       func(userID string) ([]bridgeclient.BridgeAgentInfo, error)
	agentCompletionFunc func(agent string, request bridgeclient.CompletionRequest) (string, error)
	lastCompletionReq   bridgeclient.CompletionRequest
	lastCompletionAgent string
}

func (m *mockBridgeClient) GetAgents(userID string) ([]bridgeclient.BridgeAgentInfo, error) {
	if m.getAgentsFunc != nil {
		return m.getAgentsFunc(userID)
	}
	return nil, nil
}

func (m *mockBridgeClient) AgentCompletion(agent string, request bridgeclient.CompletionRequest) (string, error) {
	m.lastCompletionAgent = agent
	m.lastCompletionReq = request
	if m.agentCompletionFunc != nil {
		return m.agentCompletionFunc(agent, request)
	}
	return "", nil
}

func TestParseDueDate(t *testing.T) {
	t.Run("returns 0 for empty string", func(t *testing.T) {
		result := parseDueDate("")
		assert.Equal(t, int64(0), result)
	})

	t.Run("returns 0 for invalid date format", func(t *testing.T) {
		result := parseDueDate("not-a-date")
		assert.Equal(t, int64(0), result)
	})

	t.Run("returns 0 for wrong date format", func(t *testing.T) {
		result := parseDueDate("01/15/2024")
		assert.Equal(t, int64(0), result)
	})

	t.Run("parses valid ISO date correctly", func(t *testing.T) {
		// 2024-01-15 at midnight UTC in milliseconds
		// Jan 15, 2024 00:00:00 UTC
		result := parseDueDate("2024-01-15")
		// Expected: Unix timestamp in ms for 2024-01-15 00:00:00 UTC
		// 1705276800 seconds * 1000 = 1705276800000 ms
		assert.Equal(t, int64(1705276800000), result)
	})

	t.Run("parses another valid date", func(t *testing.T) {
		result := parseDueDate("2023-12-25")
		// Dec 25, 2023 00:00:00 UTC = 1703462400 seconds * 1000
		assert.Equal(t, int64(1703462400000), result)
	})
}

func TestStripMarkdownCodeFences(t *testing.T) {
	t.Run("returns plain JSON unchanged", func(t *testing.T) {
		input := `{"title": "Test"}`
		result := stripMarkdownCodeFences(input)
		assert.Equal(t, `{"title": "Test"}`, result)
	})

	t.Run("strips json code fence", func(t *testing.T) {
		input := "```json\n{\"title\": \"Test\"}\n```"
		result := stripMarkdownCodeFences(input)
		assert.Equal(t, `{"title": "Test"}`, result)
	})

	t.Run("strips plain code fence", func(t *testing.T) {
		input := "```\n{\"title\": \"Test\"}\n```"
		result := stripMarkdownCodeFences(input)
		assert.Equal(t, `{"title": "Test"}`, result)
	})

	t.Run("handles whitespace around fences", func(t *testing.T) {
		input := "  ```json\n{\"title\": \"Test\"}\n```  "
		result := stripMarkdownCodeFences(input)
		assert.Equal(t, `{"title": "Test"}`, result)
	})

	t.Run("handles only opening fence", func(t *testing.T) {
		input := "```json\n{\"title\": \"Test\"}"
		result := stripMarkdownCodeFences(input)
		assert.Equal(t, `{"title": "Test"}`, result)
	})
}

func TestGeneratedChecklist_ToChecklists(t *testing.T) {
	t.Run("converts empty checklist", func(t *testing.T) {
		g := &GeneratedChecklist{
			Title:    "Empty Checklist",
			Sections: []GeneratedSection{},
		}

		result := g.ToChecklists()

		assert.Empty(t, result)
	})

	t.Run("converts single section with items", func(t *testing.T) {
		g := &GeneratedChecklist{
			Title: "Test Checklist",
			Sections: []GeneratedSection{
				{
					Title: "Section 1",
					Items: []GeneratedItem{
						{Title: "Task 1", Description: "Description 1", DueDate: "2024-01-15"},
						{Title: "Task 2", Description: "Description 2", DueDate: ""},
					},
				},
			},
		}

		result := g.ToChecklists()

		require.Len(t, result, 1)
		assert.Equal(t, "Section 1", result[0].Title)
		assert.NotEmpty(t, result[0].ID)
		require.Len(t, result[0].Items, 2)

		// Check first item
		assert.Equal(t, "Task 1", result[0].Items[0].Title)
		assert.Equal(t, "Description 1", result[0].Items[0].Description)
		assert.Equal(t, int64(1705276800000), result[0].Items[0].DueDate)
		assert.NotEmpty(t, result[0].Items[0].ID)

		// Check second item
		assert.Equal(t, "Task 2", result[0].Items[1].Title)
		assert.Equal(t, "Description 2", result[0].Items[1].Description)
		assert.Equal(t, int64(0), result[0].Items[1].DueDate)
		assert.NotEmpty(t, result[0].Items[1].ID)

		// Check items order
		assert.Len(t, result[0].ItemsOrder, 2)
		assert.Equal(t, result[0].Items[0].ID, result[0].ItemsOrder[0])
		assert.Equal(t, result[0].Items[1].ID, result[0].ItemsOrder[1])
	})

	t.Run("converts multiple sections", func(t *testing.T) {
		g := &GeneratedChecklist{
			Title: "Multi-Section Checklist",
			Sections: []GeneratedSection{
				{Title: "Section A", Items: []GeneratedItem{{Title: "Task A1"}}},
				{Title: "Section B", Items: []GeneratedItem{{Title: "Task B1"}, {Title: "Task B2"}}},
				{Title: "Section C", Items: []GeneratedItem{}},
			},
		}

		result := g.ToChecklists()

		require.Len(t, result, 3)
		assert.Equal(t, "Section A", result[0].Title)
		assert.Len(t, result[0].Items, 1)
		assert.Equal(t, "Section B", result[1].Title)
		assert.Len(t, result[1].Items, 2)
		assert.Equal(t, "Section C", result[2].Title)
		assert.Empty(t, result[2].Items)
	})

	t.Run("generates unique IDs for each checklist", func(t *testing.T) {
		g := &GeneratedChecklist{
			Title: "Test",
			Sections: []GeneratedSection{
				{Title: "Section 1", Items: []GeneratedItem{{Title: "Task 1"}}},
				{Title: "Section 2", Items: []GeneratedItem{{Title: "Task 2"}}},
			},
		}

		result := g.ToChecklists()

		require.Len(t, result, 2)
		assert.NotEqual(t, result[0].ID, result[1].ID)
	})

	t.Run("generates unique IDs for each item", func(t *testing.T) {
		g := &GeneratedChecklist{
			Title: "Test",
			Sections: []GeneratedSection{
				{
					Title: "Section 1",
					Items: []GeneratedItem{
						{Title: "Task 1"},
						{Title: "Task 2"},
						{Title: "Task 3"},
					},
				},
			},
		}

		result := g.ToChecklists()

		require.Len(t, result, 1)
		require.Len(t, result[0].Items, 3)

		// All IDs should be unique
		ids := make(map[string]bool)
		for _, item := range result[0].Items {
			assert.False(t, ids[item.ID], "Item ID should be unique")
			ids[item.ID] = true
		}
	})

	t.Run("sets empty state for items", func(t *testing.T) {
		g := &GeneratedChecklist{
			Title: "Test",
			Sections: []GeneratedSection{
				{Title: "Section", Items: []GeneratedItem{{Title: "Task"}}},
			},
		}

		result := g.ToChecklists()

		require.Len(t, result, 1)
		require.Len(t, result[0].Items, 1)
		assert.Equal(t, "", result[0].Items[0].State)
	})
}

func TestAIService_IsAvailable(t *testing.T) {
	t.Run("returns nil when plugin is available", func(t *testing.T) {
		mockClient := &mockBridgeClient{
			getAgentsFunc: func(userID string) ([]bridgeclient.BridgeAgentInfo, error) {
				return []bridgeclient.BridgeAgentInfo{{ID: "agent1"}}, nil
			},
		}
		mockCfg := &mockConfigService{config: &config.Configuration{}}
		service := NewAIService(mockClient, mockCfg)

		err := service.IsAvailable()

		assert.NoError(t, err)
	})

	t.Run("returns error when plugin is unavailable", func(t *testing.T) {
		mockClient := &mockBridgeClient{
			getAgentsFunc: func(userID string) ([]bridgeclient.BridgeAgentInfo, error) {
				return nil, errors.New("connection refused")
			},
		}
		mockCfg := &mockConfigService{config: &config.Configuration{}}
		service := NewAIService(mockClient, mockCfg)

		err := service.IsAvailable()

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "AI plugin not available")
		assert.Contains(t, err.Error(), "connection refused")
	})
}

func TestAIService_GenerateChecklist(t *testing.T) {
	t.Run("returns error when agent not configured", func(t *testing.T) {
		mockClient := &mockBridgeClient{}
		mockCfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistAgentBotID: "", // Not configured
			},
		}
		service := NewAIService(mockClient, mockCfg)

		result, err := service.GenerateChecklist(QuicklistGenerateRequest{
			ThreadContent: "test content",
			ChannelID:     "channel123",
			UserID:        "user123",
		})

		assert.Nil(t, result)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "quicklist agent not configured")
	})

	t.Run("returns error when AI completion fails", func(t *testing.T) {
		mockClient := &mockBridgeClient{
			agentCompletionFunc: func(agent string, request bridgeclient.CompletionRequest) (string, error) {
				return "", errors.New("AI service error")
			},
		}
		mockCfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistAgentBotID: "bot123",
			},
		}
		service := NewAIService(mockClient, mockCfg)

		result, err := service.GenerateChecklist(QuicklistGenerateRequest{
			ThreadContent: "test content",
			ChannelID:     "channel123",
			UserID:        "user123",
		})

		assert.Nil(t, result)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "AI completion failed")
	})

	t.Run("returns error when AI response is invalid JSON", func(t *testing.T) {
		mockClient := &mockBridgeClient{
			agentCompletionFunc: func(agent string, request bridgeclient.CompletionRequest) (string, error) {
				return "not valid json", nil
			},
		}
		mockCfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistAgentBotID: "bot123",
			},
		}
		service := NewAIService(mockClient, mockCfg)

		result, err := service.GenerateChecklist(QuicklistGenerateRequest{
			ThreadContent: "test content",
			ChannelID:     "channel123",
			UserID:        "user123",
		})

		assert.Nil(t, result)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to parse AI response")
	})

	t.Run("successfully generates checklist", func(t *testing.T) {
		mockClient := &mockBridgeClient{
			agentCompletionFunc: func(agent string, request bridgeclient.CompletionRequest) (string, error) {
				return `{
					"title": "Q4 Launch",
					"sections": [
						{
							"title": "Design",
							"items": [
								{"title": "Create mockups", "description": "High fidelity designs", "due_date": "2024-01-15"}
							]
						}
					]
				}`, nil
			},
		}
		mockCfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistAgentBotID: "bot123",
			},
		}
		service := NewAIService(mockClient, mockCfg)

		result, err := service.GenerateChecklist(QuicklistGenerateRequest{
			ThreadContent: "test content",
			ChannelID:     "channel123",
			UserID:        "user123",
		})

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, "Q4 Launch", result.Title)
		require.Len(t, result.Sections, 1)
		assert.Equal(t, "Design", result.Sections[0].Title)
		require.Len(t, result.Sections[0].Items, 1)
		assert.Equal(t, "Create mockups", result.Sections[0].Items[0].Title)
		assert.Equal(t, "2024-01-15", result.Sections[0].Items[0].DueDate)
	})

	t.Run("uses default prompts when not configured", func(t *testing.T) {
		mockClient := &mockBridgeClient{
			agentCompletionFunc: func(agent string, request bridgeclient.CompletionRequest) (string, error) {
				return `{"title": "Test", "sections": []}`, nil
			},
		}
		mockCfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistAgentBotID:   "bot123",
				QuicklistSystemPrompt: "",
				QuicklistUserPrompt:   "",
			},
		}
		service := NewAIService(mockClient, mockCfg)

		_, err := service.GenerateChecklist(QuicklistGenerateRequest{
			ThreadContent: "test content",
			ChannelID:     "channel123",
			UserID:        "user123",
		})

		require.NoError(t, err)

		// Verify default prompts were used
		require.Len(t, mockClient.lastCompletionReq.Posts, 2)
		assert.Equal(t, "system", mockClient.lastCompletionReq.Posts[0].Role)
		assert.Contains(t, mockClient.lastCompletionReq.Posts[0].Message, "You are an assistant that analyzes conversation threads")
		assert.Equal(t, "user", mockClient.lastCompletionReq.Posts[1].Role)
		assert.Contains(t, mockClient.lastCompletionReq.Posts[1].Message, "test content")
	})

	t.Run("uses custom prompts when configured", func(t *testing.T) {
		mockClient := &mockBridgeClient{
			agentCompletionFunc: func(agent string, request bridgeclient.CompletionRequest) (string, error) {
				return `{"title": "Test", "sections": []}`, nil
			},
		}
		mockCfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistAgentBotID:   "bot123",
				QuicklistSystemPrompt: "Custom system prompt",
				QuicklistUserPrompt:   "Custom user prompt: %s",
			},
		}
		service := NewAIService(mockClient, mockCfg)

		_, err := service.GenerateChecklist(QuicklistGenerateRequest{
			ThreadContent: "my thread",
			ChannelID:     "channel123",
			UserID:        "user123",
		})

		require.NoError(t, err)

		// Verify custom prompts were used
		require.Len(t, mockClient.lastCompletionReq.Posts, 2)
		assert.Equal(t, "Custom system prompt", mockClient.lastCompletionReq.Posts[0].Message)
		assert.Equal(t, "Custom user prompt: my thread", mockClient.lastCompletionReq.Posts[1].Message)
	})

	t.Run("passes correct agent ID and request parameters", func(t *testing.T) {
		mockClient := &mockBridgeClient{
			agentCompletionFunc: func(agent string, request bridgeclient.CompletionRequest) (string, error) {
				return `{"title": "Test", "sections": []}`, nil
			},
		}
		mockCfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistAgentBotID: "my-agent-bot",
			},
		}
		service := NewAIService(mockClient, mockCfg)

		_, err := service.GenerateChecklist(QuicklistGenerateRequest{
			ThreadContent: "thread content",
			ChannelID:     "ch123",
			UserID:        "usr456",
		})

		require.NoError(t, err)

		assert.Equal(t, "my-agent-bot", mockClient.lastCompletionAgent)
		assert.Equal(t, "ch123", mockClient.lastCompletionReq.ChannelID)
		assert.Equal(t, "usr456", mockClient.lastCompletionReq.UserID)
	})
}
