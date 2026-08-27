// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRunsPerPage(t *testing.T) {
	int32Ptr := func(v int32) *int32 { return &v }

	for _, tc := range []struct {
		name     string
		first    *int32
		expected int
	}{
		{"a request without pagination is still bounded", nil, maxRunsPerPage},
		{"a page size beyond the bound is clamped", int32Ptr(10000), maxRunsPerPage},
		{"a page size at the bound is kept", int32Ptr(maxRunsPerPage), maxRunsPerPage},
		{"a page size below the bound is kept", int32Ptr(8), 8},
		{"an empty page is left to the store", int32Ptr(0), 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, runsPerPage(tc.first))
		})
	}
}

func TestRecordBudget(t *testing.T) {
	t.Run("admits a page only when the whole page fits", func(t *testing.T) {
		budget := &recordBudget{limit: 10}
		require.NoError(t, budget.reserve(9))

		require.Error(t, budget.reserve(2))
		require.NoError(t, budget.reserve(1))
	})

	t.Run("leaves an empty page to the store", func(t *testing.T) {
		budget := &recordBudget{limit: 10}
		require.NoError(t, budget.reserve(10))

		require.NoError(t, budget.reserve(0))
	})

	t.Run("reports the limit back to the client", func(t *testing.T) {
		budget := &recordBudget{limit: 10}
		require.NoError(t, budget.reserve(10))

		err := budget.reserve(1)
		require.Error(t, err)
		require.True(t, isGraphQLErrorable(err))
		require.Contains(t, err.Error(), "10 records per request")
	})

	t.Run("keeps the capacity a short listing did not use", func(t *testing.T) {
		budget := &recordBudget{limit: 10}
		require.NoError(t, budget.reserve(10))
		require.Error(t, budget.reserve(10))

		const fetched = 2
		budget.release(10 - fetched)

		require.NoError(t, budget.reserve(10-fetched))
	})

	t.Run("admits no more than the limit when fields race", func(t *testing.T) {
		budget := &recordBudget{limit: 1000}

		// The reservations are released together so that they contend for the
		// same remaining capacity, as parallel field resolution does.
		start := make(chan struct{})
		var admitted atomic.Int64
		var wg sync.WaitGroup
		for range 100 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				<-start
				if err := budget.reserve(100); err == nil {
					admitted.Add(100)
				}
			}()
		}
		close(start)
		wg.Wait()

		require.Equal(t, int64(1000), admitted.Load())
	})
}

// The webapp's PlaybooksModal query resolves one run listing and two playbook
// listings in a single request, so those pages have to fit in the budget
// together or the query fails against a server holding enough records.
func TestLargestClientQueryFitsTheBudget(t *testing.T) {
	require.LessOrEqual(t, maxRunsPerPage+(2*maxPlaybooksPerPage), maxRecordsPerRequest)
}
