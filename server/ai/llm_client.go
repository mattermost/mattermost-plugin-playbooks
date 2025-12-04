// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package ai

import (
	"github.com/pkg/errors"

	aiclient "github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
	"github.com/mattermost/mattermost/server/public/plugin"
)

const PLAYBOOK_SYSTEM_PROMPT = `You are a Mattermost Playbooks expert assistant. Your role is to help users create and refine playbooks for their teams.

## What are Mattermost Playbooks?
Playbooks are checklists and automation for recurring workflows in Mattermost. They help teams collaborate effectively by defining clear processes with tasks, slash commands, and automated actions.

## Important Guidelines:
1. Ask only ONE question at a time to understand the user's needs
2. Ask no more than 5 questions total before generating a playbook
3. After gathering basic information, generate a playbook structure that the user can refine iteratively
4. Be concise and conversational - don't overwhelm users with too many questions

## Playbook JSON Schema:
When you're ready to generate or update a playbook structure, output it in this EXACT format:

<!-- PLAYBOOK_SCHEMA -->
` + "```json" + `
{
  "checklists": [
    {
      "title": "Checklist Name",
      "items": [
        {
          "title": "Task title (required)",
          "description": "Detailed task description (optional)",
          "command": "/slash-command to run (optional, e.g., /jira-create-issue)",
          "due_date": 0,
          "state": "open",
          "state_modified": 0,
          "assignee_id": "",
          "assignee_modified": 0,
          "command_last_run": 0,
          "task_actions": [],
          "condition_id": "",
          "condition_action": "",
          "condition_reason": ""
        }
      ]
    }
  ]
}
` + "```" + `

### Field Descriptions:
- **title**: (required) Short name of the task
- **description**: (optional) Longer explanation of what needs to be done
- **command**: (optional) Mattermost slash command to run (e.g., "/remind", "/jira-create")
- **due_date**: Milliseconds since epoch, or 0 for no due date
- **state**: Must be "open", "closed", or "skipped" (default: "open")
- **assignee_id**: User ID to assign task to (empty string for unassigned)
- **task_actions**: Array of automated actions (can be empty [])
- **condition_id**, **condition_action**, **condition_reason**: For conditional task visibility (leave empty for always visible)
- All *_modified and *_last_run fields: Timestamps in milliseconds (use 0 for not set)

### Important:
- ALWAYS include the marker <!-- PLAYBOOK_SCHEMA --> on its own line before the JSON
- ALWAYS wrap the JSON in a markdown code block with json language tag
- DO NOT include explanatory text before or after the JSON in the same message
- When outputting a playbook schema, keep your message brief - just say you've created/updated the playbook
- The JSON will be rendered in a separate panel, not in the chat
- Users can ask you to refine the playbook iteratively

Remember: Be conversational and helpful. When you output a playbook schema, keep the message short since the actual structure will be displayed separately.`

// Service handles LLM interactions via the AI plugin
type Service struct {
	client    *aiclient.Client
	agentName string
}

// NewService creates a new AI service using an agent
func NewService(pluginAPI plugin.API, agentName string) *Service {
	return &Service{
		client:    aiclient.NewClient(pluginAPI),
		agentName: agentName,
	}
}

// Post represents a message in the conversation
type Post struct {
	Role    string `json:"role"`
	Message string `json:"message"`
	Files   []File `json:"files,omitempty"`
}

// File represents a file attachment
type File struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	MimeType string `json:"mime_type"`
	Data     string `json:"data"` // base64 encoded
}

// CompletionRequest is the request structure for AI completion
type CompletionRequest struct {
	Posts []Post `json:"posts"`
}

// CompletionResponse is the response from AI completion
type CompletionResponse struct {
	Message string `json:"message"`
}

// GetCompletion sends a conversation to the LLM agent and returns the response
func (s *Service) GetCompletion(userID string, posts []Post) (string, error) {
	if len(posts) == 0 {
		return "", errors.New("posts cannot be empty")
	}

	// Prepend system prompt to the conversation
	// System prompt is always the first message and establishes the AI's role
	allPosts := make([]aiclient.Post, 0, len(posts)+1)

	// Add system prompt first
	allPosts = append(allPosts, aiclient.Post{
		Role:    "system",
		Message: PLAYBOOK_SYSTEM_PROMPT,
	})

	// Convert user posts to AI client format and append
	for _, post := range posts {
		clientPost := aiclient.Post{
			Role:    post.Role,
			Message: post.Message,
		}

		// Include file IDs if present
		if len(post.Files) > 0 {
			fileIDs := make([]string, len(post.Files))
			for i, f := range post.Files {
				fileIDs[i] = f.ID
			}
			clientPost.FileIDs = fileIDs
		}

		allPosts = append(allPosts, clientPost)
	}

	// Create the completion request with system prompt + conversation
	request := aiclient.CompletionRequest{
		Posts:  allPosts,
		UserID: userID,
	}

	// Call the AI agent
	response, err := s.client.AgentCompletion(s.agentName, request)
	if err != nil {
		return "", errors.Wrap(err, "failed to get completion from AI agent")
	}

	return response, nil
}

// AIBot represents information about an AI bot
type AIBot struct {
	ID                 string   `json:"id"`
	DisplayName        string   `json:"displayName"`
	Username           string   `json:"username"`
	LastIconUpdate     int64    `json:"lastIconUpdate"`
	DMChannelID        string   `json:"dmChannelID"`
	ChannelAccessLevel string   `json:"channelAccessLevel"`
	ChannelIDs         []string `json:"channelIDs"`
	UserAccessLevel    string   `json:"userAccessLevel"`
	UserIDs            []string `json:"userIDs"`
}

// AIBotsResponse represents the response from GetAIBots
type AIBotsResponse struct {
	Bots             []AIBot `json:"bots"`
	SearchEnabled    bool    `json:"searchEnabled"`
	AllowUnsafeLinks bool    `json:"allowUnsafeLinks"`
}

// GetAIBots fetches the available AI bots from the AI plugin
func (s *Service) GetAIBots() (*AIBotsResponse, error) {
	// Call the AI plugin to get agents (bots)
	agents, err := s.client.GetAgents("")
	if err != nil {
		return nil, errors.Wrap(err, "failed to get AI agents")
	}

	// Convert to our response format
	bots := make([]AIBot, len(agents))
	for i, agent := range agents {
		bots[i] = AIBot{
			ID:          agent.ID,
			DisplayName: agent.DisplayName,
			Username:    agent.Username,
			// Note: bridgeclient.BridgeAgentInfo doesn't include all fields
			// The UI may need to be updated to use the available fields
		}
	}

	return &AIBotsResponse{
		Bots: bots,
		// Note: SearchEnabled and AllowUnsafeLinks are not available in bridge API
	}, nil
}
