// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSinceParameter(t *testing.T) {
	// Setup server to simulate API responses
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Parse query parameters
		query := r.URL.Query()
		sinceStr := query.Get("since")
		
		// Create response based on since parameter
		resp := GetPlaybookRunsResults{
			TotalCount: 2,
			PageCount:  1,
			HasMore:    false,
			Items:      []PlaybookRun{},
		}

		// Parse since parameter if present
		if sinceStr != "" {
			since, err := strconv.ParseInt(sinceStr, 10, 64)
			if err != nil {
				http.Error(w, "Invalid since parameter", http.StatusBadRequest)
				return
			}

			// Create timestamps for testing
			now := time.Now().UnixMilli()
			
			// Add playbook runs that would be updated after the since timestamp
			if since < now {
				// First run updated after since
				run1 := PlaybookRun{
					ID:       "run1",
					Name:     "Run 1",
					CreateAt: since - 10000, // Created before since
					UpdateAt: since + 5000,  // Updated after since
				}
				
				// Second run updated after since
				run2 := PlaybookRun{
					ID:       "run2",
					Name:     "Run 2",
					CreateAt: since + 1000, // Created after since
					UpdateAt: since + 2000, // Updated after since
				}
				
				resp.Items = append(resp.Items, run1, run2)
			}
			
			// Add finished runs info
			finishedRun := FinishedRun{
				ID:    "finished1",
				EndAt: since + 1000,
			}
			resp.FinishedIDs = []FinishedRun{finishedRun}
		}

		// Return JSON response
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	// Create test client
	parsed, _ := url.Parse(ts.URL)
	mockClient4 := model.NewAPIv4Client(parsed.String())
	mockClient4.HTTPClient = &http.Client{}
	
	c, err := New(mockClient4)
	require.NoError(t, err)

	// Test 1: Get runs with since parameter
	t.Run("WithSinceParameter", func(t *testing.T) {
		// Set since time to 1 hour ago
		since := time.Now().Add(-1 * time.Hour).UnixMilli()
		
		// Call API with since parameter
		ctx := context.Background()
		result, err := c.PlaybookRuns.List(ctx, 0, 100, PlaybookRunListOptions{
			SinceUpdateAt: since,
		})
		
		// Verify results
		require.NoError(t, err)
		assert.Equal(t, 2, result.TotalCount, "Should return 2 runs")
		assert.Len(t, result.Items, 2, "Should have 2 runs in items")
		assert.Len(t, result.FinishedIDs, 1, "Should have 1 finished run")
		
		// Verify first run fields
		assert.Equal(t, "run1", result.Items[0].ID)
		assert.Less(t, result.Items[0].CreateAt, since, "First run should be created before since")
		assert.Greater(t, result.Items[0].UpdateAt, since, "First run should be updated after since")
		
		// Verify second run fields
		assert.Equal(t, "run2", result.Items[1].ID)
		assert.Greater(t, result.Items[1].CreateAt, since, "Second run should be created after since")
		assert.Greater(t, result.Items[1].UpdateAt, since, "Second run should be updated after since")
		
		// Verify finished run fields
		assert.Equal(t, "finished1", result.FinishedIDs[0].ID)
		assert.Greater(t, result.FinishedIDs[0].EndAt, since, "Finished run should end after since")
	})

	// Test 2: Get runs with future since parameter (should return empty results)
	t.Run("WithFutureSinceParameter", func(t *testing.T) {
		// Set since time to 1 hour in the future
		since := time.Now().Add(1 * time.Hour).UnixMilli()
		
		// Call API with since parameter
		ctx := context.Background()
		result, err := c.PlaybookRuns.List(ctx, 0, 100, PlaybookRunListOptions{
			SinceUpdateAt: since,
		})
		
		// Verify results
		require.NoError(t, err)
		assert.Equal(t, 2, result.TotalCount, "Should return empty results metadata")
		assert.Len(t, result.Items, 0, "Should have no runs in items")
		assert.Len(t, result.FinishedIDs, 1, "Should still have finished runs info")
	})

	// Test 3: Get runs without since parameter
	t.Run("WithoutSinceParameter", func(t *testing.T) {
		// Call API without since parameter
		ctx := context.Background()
		result, err := c.PlaybookRuns.List(ctx, 0, 100, PlaybookRunListOptions{})
		
		// Verify results
		require.NoError(t, err)
		assert.Equal(t, 2, result.TotalCount, "Should return default results")
		assert.Len(t, result.Items, 0, "Should have no items without since parameter")
		assert.Len(t, result.FinishedIDs, 0, "Should have no finished runs without since parameter")
	})

	// Test 4: Test serialization of FinishedIDs
	t.Run("FinishedIDsSerialization", func(t *testing.T) {
		// Create a response with FinishedIDs
		now := time.Now().UnixMilli()
		resp := GetPlaybookRunsResults{
			TotalCount: 0,
			PageCount:  0,
			HasMore:    false,
			Items:      []PlaybookRun{},
			FinishedIDs: []FinishedRun{
				{
					ID:    "finished1",
					EndAt: now - 1000,
				},
				{
					ID:    "finished2",
					EndAt: now,
				},
			},
		}
		
		// Serialize to JSON
		jsonData, err := json.Marshal(resp)
		require.NoError(t, err, "Failed to marshal GetPlaybookRunsResults to JSON")
		
		// Verify that FinishedIDs field exists in JSON
		jsonStr := string(jsonData)
		assert.Contains(t, jsonStr, `"finished_ids":`, "JSON should contain finished_ids field")
		assert.Contains(t, jsonStr, `"id":"finished1"`, "JSON should contain first finished run ID")
		assert.Contains(t, jsonStr, `"id":"finished2"`, "JSON should contain second finished run ID")
		assert.Contains(t, jsonStr, `"end_at":`, "JSON should contain end_at for finished runs")
		
		// Deserialize from JSON
		var decodedResp GetPlaybookRunsResults
		err = json.Unmarshal(jsonData, &decodedResp)
		require.NoError(t, err, "Failed to unmarshal GetPlaybookRunsResults from JSON")
		
		// Verify FinishedIDs was preserved
		require.Len(t, decodedResp.FinishedIDs, 2, "Should have 2 finished runs after deserialization")
		assert.Equal(t, resp.FinishedIDs[0].ID, decodedResp.FinishedIDs[0].ID, "First finished run ID should be preserved")
		assert.Equal(t, resp.FinishedIDs[0].EndAt, decodedResp.FinishedIDs[0].EndAt, "First finished run EndAt should be preserved")
		assert.Equal(t, resp.FinishedIDs[1].ID, decodedResp.FinishedIDs[1].ID, "Second finished run ID should be preserved")
		assert.Equal(t, resp.FinishedIDs[1].EndAt, decodedResp.FinishedIDs[1].EndAt, "Second finished run EndAt should be preserved")
	})
	
	// Test 5: Verify URL encoding of since parameter
	t.Run("URLEncoding", func(t *testing.T) {
		// Create a custom server to check URL encoding
		urlCheckServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			
			// Check that the since parameter is properly included in the URL
			query := r.URL.Query()
			sinceStr := query.Get("since")
			
			// Validate that since parameter exists and has the expected value
			require.NotEmpty(t, sinceStr, "SinceUpdateAt parameter should be present in URL")
			
			// Parse the value and verify it matches what we sent
			since, err := strconv.ParseInt(sinceStr, 10, 64)
			require.NoError(t, err, "SinceUpdateAt parameter should be a valid int64")
			assert.Equal(t, int64(12345), since, "SinceUpdateAt parameter should match the value we sent")
			
			// Return an empty success response
			w.WriteHeader(http.StatusOK)
			empty := GetPlaybookRunsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []PlaybookRun{},
			}
			json.NewEncoder(w).Encode(empty)
		}))
		defer urlCheckServer.Close()
		
		// Create a client pointing to our URL check server
		parsedURL, _ := url.Parse(urlCheckServer.URL)
		urlCheckClient4 := model.NewAPIv4Client(parsedURL.String())
		urlCheckClient4.HTTPClient = &http.Client{}
		
		urlCheckC, err := New(urlCheckClient4)
		require.NoError(t, err)
		
		// Make the request with a specific since value that we can check
		ctx := context.Background()
		_, err = urlCheckC.PlaybookRuns.List(ctx, 0, 100, PlaybookRunListOptions{
			SinceUpdateAt: 12345,
		})
		require.NoError(t, err, "Request with since parameter should succeed")
	})
}