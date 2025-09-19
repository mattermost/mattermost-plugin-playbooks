// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParsePaginationParams(t *testing.T) {
	tests := []struct {
		name            string
		queryParams     map[string]string
		expectedPage    int
		expectedPerPage int
	}{
		{
			name:            "no parameters",
			queryParams:     map[string]string{},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "page negative",
			queryParams:     map[string]string{"page": "-1"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "page zero",
			queryParams:     map[string]string{"page": "0"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "page positive",
			queryParams:     map[string]string{"page": "5"},
			expectedPage:    5,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "per_page negative",
			queryParams:     map[string]string{"per_page": "-1"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "per_page zero",
			queryParams:     map[string]string{"per_page": "0"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "per_page positive",
			queryParams:     map[string]string{"per_page": "50"},
			expectedPage:    0,
			expectedPerPage: 50,
		},
		{
			name:            "per_page over max",
			queryParams:     map[string]string{"per_page": "300"},
			expectedPage:    0,
			expectedPerPage: MaxPerPage,
		},
		{
			name:            "both parameters valid",
			queryParams:     map[string]string{"page": "3", "per_page": "25"},
			expectedPage:    3,
			expectedPerPage: 25,
		},
		{
			name:            "invalid page string",
			queryParams:     map[string]string{"page": "invalid"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "invalid per_page string",
			queryParams:     map[string]string{"per_page": "invalid"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := url.Values{}
			for key, value := range tt.queryParams {
				query.Set(key, value)
			}

			page, perPage := parsePaginationParams(query)

			assert.Equal(t, tt.expectedPage, page)
			assert.Equal(t, tt.expectedPerPage, perPage)
		})
	}
}
