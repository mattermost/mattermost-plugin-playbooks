// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeRunNumberPrefix(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		output string
	}{
		{name: "empty string unchanged", input: "", output: ""},
		{name: "strips trailing hyphen", input: "ABC-", output: "ABC"},
		{name: "strips leading hyphen", input: "-ABC", output: "ABC"},
		{name: "strips both hyphens", input: "-ABC-", output: "ABC"},
		{name: "strips leading whitespace", input: "  INC", output: "INC"},
		{name: "strips trailing whitespace", input: "INC  ", output: "INC"},
		{name: "strips whitespace and trailing hyphen", input: " INC- ", output: "INC"},
		{name: "preserves interior hyphens", input: "A-B-C", output: "A-B-C"},
		{name: "already clean prefix unchanged", input: "INC", output: "INC"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.output, NormalizeRunNumberPrefix(tt.input))
		})
	}
}

func TestValidateRunNumberPrefix(t *testing.T) {
	tests := []struct {
		name    string
		prefix  string
		wantErr bool
	}{
		{
			name:    "empty string is valid",
			prefix:  "",
			wantErr: false,
		},
		{
			name:    "valid alphabetic prefix",
			prefix:  "INC",
			wantErr: false,
		},
		{
			name:    "valid prefix with hyphens",
			prefix:  "my-prefix",
			wantErr: false,
		},
		{
			name:    "exactly max length is valid",
			prefix:  strings.Repeat("A", MaxRunNumberPrefixLength),
			wantErr: false,
		},
		{
			name:    "over max length returns error",
			prefix:  strings.Repeat("A", MaxRunNumberPrefixLength+1),
			wantErr: true,
		},
		{
			name:    "contains space returns error",
			prefix:  "INC 001",
			wantErr: true,
		},
		{
			name:    "contains special character returns error",
			prefix:  "INC_001",
			wantErr: true,
		},
		{
			name:    "starts with hyphen returns error",
			prefix:  "-INC",
			wantErr: true,
		},
		{
			name:    "ends with hyphen returns error",
			prefix:  "INC-",
			wantErr: true,
		},
		{
			name:    "single character is valid",
			prefix:  "X",
			wantErr: false,
		},
		{
			name:    "numeric prefix is valid",
			prefix:  "123",
			wantErr: false,
		},
		{
			name:    "mixed alphanumeric with hyphen is valid",
			prefix:  "INC-2024",
			wantErr: false,
		},
		{
			name:    "contains dot returns error",
			prefix:  "INC.001",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRunNumberPrefix(tt.prefix)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestValidateChannelNameTemplate(t *testing.T) {
	tests := []struct {
		name    string
		tmpl    string
		wantErr bool
	}{
		{
			name:    "empty string is valid",
			tmpl:    "",
			wantErr: false,
		},
		{
			name:    "valid template with SEQ placeholder",
			tmpl:    "{SEQ}-incident",
			wantErr: false,
		},
		{
			name:    "plain text template is valid",
			tmpl:    "my-channel",
			wantErr: false,
		},
		{
			name:    "whitespace-only returns error",
			tmpl:    "   ",
			wantErr: true,
		},
		{
			name:    "single tab returns error",
			tmpl:    "\t",
			wantErr: true,
		},
		{
			name:    "exactly max length is valid",
			tmpl:    strings.Repeat("a", MaxChannelNameTemplateLength),
			wantErr: false,
		},
		{
			name:    "over max length returns error",
			tmpl:    strings.Repeat("a", MaxChannelNameTemplateLength+1),
			wantErr: true,
		},
		{
			name:    "multibyte runes at exactly max length is valid",
			tmpl:    strings.Repeat("こ", MaxChannelNameTemplateLength),
			wantErr: false,
		},
		{
			name:    "multibyte runes over max length returns error",
			tmpl:    strings.Repeat("こ", MaxChannelNameTemplateLength+1),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateChannelNameTemplate(tt.tmpl)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestIsValidAssigneeType(t *testing.T) {
	tests := []struct {
		name         string
		assigneeType string
		want         bool
	}{
		{
			name:         "empty string is valid (specific user)",
			assigneeType: AssigneeTypeSpecificUser,
			want:         true,
		},
		{
			name:         "owner is valid",
			assigneeType: AssigneeTypeOwner,
			want:         true,
		},
		{
			name:         "creator is valid",
			assigneeType: AssigneeTypeCreator,
			want:         true,
		},
		{
			name:         "invalid string returns false",
			assigneeType: "invalid",
			want:         false,
		},
		{
			name:         "admin returns false",
			assigneeType: "admin",
			want:         false,
		},
		{
			name:         "uppercase OWNER returns false",
			assigneeType: "OWNER",
			want:         false,
		},
		{
			name:         "whitespace returns false",
			assigneeType: " ",
			want:         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValidAssigneeType(tt.assigneeType)
			require.Equal(t, tt.want, result)
		})
	}
}
