package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetSiteStats(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("get sites stats", func(t *testing.T) {
		t.Run("unauthenticated", func(t *testing.T) {
			stats, err := e.UnauthenticatedPlaybooksClient.Stats.GetSiteStats(context.Background())
			assert.Nil(t, stats)
			requireErrorWithStatusCode(t, err, http.StatusUnauthorized)
		})

		t.Run("get stats for basic server", func(t *testing.T) {
			stats, err := e.PlaybooksAdminClient.Stats.GetSiteStats(context.Background())
			require.NoError(t, err)
			assert.NotEmpty(t, stats)
			assert.Equal(t, 1, stats.TotalPlaybookRuns)
			assert.Equal(t, 4, stats.TotalPlaybooks)
		})

	})

}
