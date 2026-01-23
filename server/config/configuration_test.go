// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConfiguration_SetDefaults(t *testing.T) {
	tests := []struct {
		name     string
		config   Configuration
		expected Configuration
	}{
		{
			name:   "applies defaults when values are zero",
			config: Configuration{},
			expected: Configuration{
				QuicklistMaxMessages:   DefaultQuicklistMaxMessages,
				QuicklistMaxCharacters: DefaultQuicklistMaxCharacters,
			},
		},
		{
			name: "applies defaults when values are negative",
			config: Configuration{
				QuicklistMaxMessages:   -10,
				QuicklistMaxCharacters: -500,
			},
			expected: Configuration{
				QuicklistMaxMessages:   DefaultQuicklistMaxMessages,
				QuicklistMaxCharacters: DefaultQuicklistMaxCharacters,
			},
		},
		{
			name: "preserves valid positive values",
			config: Configuration{
				QuicklistMaxMessages:   100,
				QuicklistMaxCharacters: 20000,
			},
			expected: Configuration{
				QuicklistMaxMessages:   100,
				QuicklistMaxCharacters: 20000,
			},
		},
		{
			name: "preserves other fields unchanged",
			config: Configuration{
				QuicklistEnabled:       true,
				QuicklistAgentBotID:    "bot123",
				QuicklistSystemPrompt:  "custom prompt",
				QuicklistMaxMessages:   0,
				QuicklistMaxCharacters: 0,
			},
			expected: Configuration{
				QuicklistEnabled:       true,
				QuicklistAgentBotID:    "bot123",
				QuicklistSystemPrompt:  "custom prompt",
				QuicklistMaxMessages:   DefaultQuicklistMaxMessages,
				QuicklistMaxCharacters: DefaultQuicklistMaxCharacters,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.config.SetDefaults()
			require.Equal(t, tt.expected.QuicklistMaxMessages, tt.config.QuicklistMaxMessages)
			require.Equal(t, tt.expected.QuicklistMaxCharacters, tt.config.QuicklistMaxCharacters)
			require.Equal(t, tt.expected.QuicklistEnabled, tt.config.QuicklistEnabled)
			require.Equal(t, tt.expected.QuicklistAgentBotID, tt.config.QuicklistAgentBotID)
			require.Equal(t, tt.expected.QuicklistSystemPrompt, tt.config.QuicklistSystemPrompt)
		})
	}
}

func TestConfiguration_Validate(t *testing.T) {
	tests := []struct {
		name      string
		config    Configuration
		wantErr   bool
		errSubstr string
	}{
		{
			name: "valid configuration with defaults",
			config: Configuration{
				QuicklistMaxMessages:   DefaultQuicklistMaxMessages,
				QuicklistMaxCharacters: DefaultQuicklistMaxCharacters,
			},
			wantErr: false,
		},
		{
			name: "valid configuration with custom values",
			config: Configuration{
				QuicklistMaxMessages:   100,
				QuicklistMaxCharacters: 50000,
			},
			wantErr: false,
		},
		{
			name: "valid configuration with minimum values",
			config: Configuration{
				QuicklistMaxMessages:   1,
				QuicklistMaxCharacters: 100,
			},
			wantErr: false,
		},
		{
			name: "invalid: QuicklistMaxMessages is zero",
			config: Configuration{
				QuicklistMaxMessages:   0,
				QuicklistMaxCharacters: DefaultQuicklistMaxCharacters,
			},
			wantErr:   true,
			errSubstr: "QuicklistMaxMessages",
		},
		{
			name: "invalid: QuicklistMaxMessages is negative",
			config: Configuration{
				QuicklistMaxMessages:   -5,
				QuicklistMaxCharacters: DefaultQuicklistMaxCharacters,
			},
			wantErr:   true,
			errSubstr: "QuicklistMaxMessages",
		},
		{
			name: "invalid: QuicklistMaxCharacters below minimum",
			config: Configuration{
				QuicklistMaxMessages:   DefaultQuicklistMaxMessages,
				QuicklistMaxCharacters: 50,
			},
			wantErr:   true,
			errSubstr: "QuicklistMaxCharacters",
		},
		{
			name: "invalid: QuicklistMaxCharacters is zero",
			config: Configuration{
				QuicklistMaxMessages:   DefaultQuicklistMaxMessages,
				QuicklistMaxCharacters: 0,
			},
			wantErr:   true,
			errSubstr: "QuicklistMaxCharacters",
		},
		{
			name: "invalid: QuicklistMaxCharacters is negative",
			config: Configuration{
				QuicklistMaxMessages:   DefaultQuicklistMaxMessages,
				QuicklistMaxCharacters: -1000,
			},
			wantErr:   true,
			errSubstr: "QuicklistMaxCharacters",
		},
		{
			name: "invalid: QuicklistEnabled without AgentBotID",
			config: Configuration{
				QuicklistEnabled:       true,
				QuicklistAgentBotID:    "",
				QuicklistMaxMessages:   DefaultQuicklistMaxMessages,
				QuicklistMaxCharacters: DefaultQuicklistMaxCharacters,
			},
			wantErr:   true,
			errSubstr: "QuicklistAgentBotID",
		},
		{
			name: "valid: QuicklistEnabled with AgentBotID",
			config: Configuration{
				QuicklistEnabled:       true,
				QuicklistAgentBotID:    "bot123",
				QuicklistMaxMessages:   DefaultQuicklistMaxMessages,
				QuicklistMaxCharacters: DefaultQuicklistMaxCharacters,
			},
			wantErr: false,
		},
		{
			name: "valid: QuicklistDisabled without AgentBotID",
			config: Configuration{
				QuicklistEnabled:       false,
				QuicklistAgentBotID:    "",
				QuicklistMaxMessages:   DefaultQuicklistMaxMessages,
				QuicklistMaxCharacters: DefaultQuicklistMaxCharacters,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errSubstr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestConfiguration_SetDefaultsThenValidate(t *testing.T) {
	// Verify that SetDefaults produces a valid configuration
	// Note: QuicklistEnabled defaults to false, so no AgentBotID is required
	config := Configuration{}
	config.SetDefaults()
	err := config.Validate()
	require.NoError(t, err, "SetDefaults should produce a valid configuration")
}