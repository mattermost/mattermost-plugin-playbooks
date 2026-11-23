// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// exhaustedBudgetContext has no permissions service, so a resolver that checks permissions
// before charging the budget panics instead of returning the budget error.
func exhaustedBudgetContext() context.Context {
	return context.WithValue(context.Background(), ctxKey{}, &GraphQLContext{
		r:            httptest.NewRequest("POST", "/query", nil),
		recordBudget: &recordBudget{limit: 0},
	})
}

func TestRootLookupsChargeTheBudgetBeforeCheckingPermissions(t *testing.T) {
	t.Run("run", func(t *testing.T) {
		var resolver RunRootResolver
		run, err := resolver.Run(exhaustedBudgetContext(), struct {
			ID string `url:"id,omitempty"`
		}{ID: "abcdefghijklmnopqrstuvwxyz"})

		require.Error(t, err)
		assert.Contains(t, err.Error(), "records per request")
		assert.Nil(t, run)
	})

	t.Run("playbook", func(t *testing.T) {
		playbook, err := getGraphqlPlaybook(exhaustedBudgetContext(), "abcdefghijklmnopqrstuvwxyz")

		require.Error(t, err)
		assert.Contains(t, err.Error(), "records per request")
		assert.Nil(t, playbook)
	})
}
