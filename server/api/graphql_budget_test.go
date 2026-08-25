// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"sync"
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
	t.Run("resolves while the request is under its limit", func(t *testing.T) {
		budget := &recordBudget{limit: 10}
		require.NoError(t, budget.check())

		budget.record(9)
		require.NoError(t, budget.check())
	})

	t.Run("stops resolving once the request reaches its limit", func(t *testing.T) {
		budget := &recordBudget{limit: 10}
		budget.record(10)

		require.Error(t, budget.check())
	})

	t.Run("reports the limit back to the client", func(t *testing.T) {
		budget := &recordBudget{limit: 10}
		budget.record(11)

		err := budget.check()
		require.Error(t, err)
		require.True(t, isGraphQLErrorable(err))
		require.Contains(t, err.Error(), "10 records per request")
	})

	t.Run("totals records across fields resolved in parallel", func(t *testing.T) {
		budget := &recordBudget{limit: 100}

		var wg sync.WaitGroup
		for range 50 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				budget.record(2)
			}()
		}
		wg.Wait()

		require.Error(t, budget.check())
	})
}
