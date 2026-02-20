// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import "fmt"

// Configuration captures the plugin's external configuration as exposed in the Mattermost server
// configuration, as well as values computed from the configuration. Any public fields will be
// deserialized from the Mattermost server configuration in OnConfigurationChange.
//
// As plugins are inherently concurrent (hooks being called asynchronously), and the plugin
// configuration can change at any time, access to the configuration must be synchronized. The
// strategy used in this plugin is to guard a pointer to the configuration, and clone the entire
// struct whenever it changes. You may replace this with whatever strategy you choose.
//
// If you add non-reference types to your configuration struct, be sure to rewrite Clone as a deep
// copy appropriate for your types.
type Configuration struct {
	// BotUserID used to post messages.
	BotUserID string

	EnableTeamsTabApp    bool   `json:"enableteamstabapp"`
	TeamsTabAppTenantIDs string `json:"teamstabapptenantids"`
	TeamsTabAppBotUserID string

	// EnableIncrementalUpdates controls whether the server sends incremental WebSocket updates
	// instead of full playbook run objects. When enabled, the server compares previous and current
	// states to determine what fields changed and only sends those changes.
	// This is set to false by default for backward compatibility.
	EnableIncrementalUpdates bool `json:"enableincrementalupdates"`

	// EnableExperimentalFeatures controls whether experimental features are enabled in the plugin.
	// These features may have in-progress UI, bugs, and other issues.
	EnableExperimentalFeatures bool `json:"enableexperimentalfeatures"`

	// QuicklistEnabled controls whether the quicklist feature is available.
	// When enabled, users can generate checklists from threads using AI.
	QuicklistEnabled bool `json:"quicklistenabled"`

	// QuicklistAgentBotID is the bot ID of the AI agent used for quicklist generation.
	// Requires mattermost-plugin-agents to be installed.
	QuicklistAgentBotID string `json:"quicklistagentbotid"`

	// QuicklistMaxMessages is the maximum number of thread messages to analyze.
	// Older messages are truncated, keeping the root post and most recent messages.
	QuicklistMaxMessages int `json:"quicklistmaxmessages"`

	// QuicklistMaxCharacters is the maximum characters to send to the AI agent.
	// Content exceeding this limit is truncated.
	QuicklistMaxCharacters int `json:"quicklistmaxcharacters"`

	// QuicklistSystemPrompt is the system prompt for AI checklist generation.
	// Leave empty to use the default prompt.
	QuicklistSystemPrompt string `json:"quicklistsystemprompt"`

	// QuicklistUserPrompt is the user prompt template for AI checklist generation.
	// Use %s as placeholder for thread content. Leave empty to use the default prompt.
	QuicklistUserPrompt string `json:"quicklistuserprompt"`
}

// Clone shallow copies the configuration. Your implementation may require a deep copy if
// your configuration has reference types.
func (c *Configuration) Clone() *Configuration {
	var clone = *c
	return &clone
}

// Quicklist configuration defaults
const (
	DefaultQuicklistMaxMessages   = 50
	DefaultQuicklistMaxCharacters = 10000
)

// SetDefaults applies default values to configuration fields that are unset or invalid.
func (c *Configuration) SetDefaults() {
	if c.QuicklistMaxMessages <= 0 {
		c.QuicklistMaxMessages = DefaultQuicklistMaxMessages
	}
	if c.QuicklistMaxCharacters <= 0 {
		c.QuicklistMaxCharacters = DefaultQuicklistMaxCharacters
	}
}

// Validate checks the configuration for invalid values.
// Returns an error describing the first invalid value found, or nil if valid.
func (c *Configuration) Validate() error {
	if c.QuicklistEnabled && c.QuicklistAgentBotID == "" {
		return fmt.Errorf("QuicklistAgentBotID is required when QuicklistEnabled is true")
	}
	if c.QuicklistMaxMessages < 1 {
		return fmt.Errorf("QuicklistMaxMessages must be at least 1, got %d", c.QuicklistMaxMessages)
	}
	if c.QuicklistMaxCharacters < 100 {
		return fmt.Errorf("QuicklistMaxCharacters must be at least 100, got %d", c.QuicklistMaxCharacters)
	}
	return nil
}

func (c *Configuration) serialize() map[string]interface{} {
	ret := make(map[string]interface{})
	ret["BotUserID"] = c.BotUserID
	ret["EnableTeamsTabApp"] = c.EnableTeamsTabApp
	ret["TeamsTabAppTenantIDs"] = c.TeamsTabAppTenantIDs
	ret["TeamsTabAppBotUserID"] = c.TeamsTabAppBotUserID
	ret["EnableIncrementalUpdates"] = c.EnableIncrementalUpdates
	ret["EnableExperimentalFeatures"] = c.EnableExperimentalFeatures
	ret["QuicklistEnabled"] = c.QuicklistEnabled
	ret["QuicklistAgentBotID"] = c.QuicklistAgentBotID
	ret["QuicklistMaxMessages"] = c.QuicklistMaxMessages
	ret["QuicklistMaxCharacters"] = c.QuicklistMaxCharacters
	ret["QuicklistSystemPrompt"] = c.QuicklistSystemPrompt
	ret["QuicklistUserPrompt"] = c.QuicklistUserPrompt
	return ret
}
