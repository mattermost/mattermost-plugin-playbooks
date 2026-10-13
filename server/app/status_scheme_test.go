// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDefaultStatusScheme(t *testing.T) {
	scheme := DefaultStatusScheme()
	require.Len(t, scheme, 2)
	require.Equal(t, StatusSlugInProgress, scheme[0].Slug)
	require.Equal(t, LifecycleOpen, scheme[0].Category)
	require.Equal(t, StatusSlugClosed, scheme[1].Slug)
	require.Equal(t, LifecycleClosed, scheme[1].Category)
}

func TestResolveStatusScheme(t *testing.T) {
	require.Equal(t, DefaultStatusScheme(), ResolveStatusScheme(nil))
	require.Equal(t, DefaultStatusScheme(), ResolveStatusScheme([]StatusSchemeOption{}))

	custom := []StatusSchemeOption{{Slug: "investigating", Name: "Investigating", Category: LifecycleOpen}}
	require.Equal(t, custom, ResolveStatusScheme(custom))
}

func TestLifecycleMapping(t *testing.T) {
	require.Equal(t, LifecycleOpen, LifecycleFromCurrentStatus(StatusInProgress))
	require.Equal(t, LifecycleClosed, LifecycleFromCurrentStatus(StatusFinished))
	require.Equal(t, StatusInProgress, CurrentStatusFromLifecycle(LifecycleOpen))
	require.Equal(t, StatusFinished, CurrentStatusFromLifecycle(LifecycleClosed))
	require.Equal(t, StatusSlugInProgress, StatusSlugFromCurrentStatus(StatusInProgress))
	require.Equal(t, StatusSlugClosed, StatusSlugFromCurrentStatus(StatusFinished))
}

func TestCurrentStatusFromStatusSlug(t *testing.T) {
	require.Equal(t, StatusInProgress, CurrentStatusFromStatusSlug(nil, StatusSlugInProgress))
	require.Equal(t, StatusFinished, CurrentStatusFromStatusSlug(nil, StatusSlugClosed))

	scheme := []StatusSchemeOption{
		{Slug: "investigating", Category: LifecycleOpen},
		{Slug: "false_positive", Category: LifecycleClosed},
	}
	require.Equal(t, StatusInProgress, CurrentStatusFromStatusSlug(scheme, "investigating"))
	require.Equal(t, StatusFinished, CurrentStatusFromStatusSlug(scheme, "false_positive"))
	require.Equal(t, StatusInProgress, CurrentStatusFromStatusSlug(scheme, "unknown"))
}

func TestFindStatusSchemeOption(t *testing.T) {
	opt, ok := FindStatusSchemeOption(nil, StatusSlugClosed)
	require.True(t, ok)
	require.Equal(t, LifecycleClosed, opt.Category)

	_, ok = FindStatusSchemeOption(nil, "missing")
	require.False(t, ok)
}

func TestFirstSlugInCategory(t *testing.T) {
	require.Equal(t, StatusSlugInProgress, FirstSlugInCategory(nil, LifecycleOpen))
	require.Equal(t, StatusSlugClosed, FirstSlugInCategory(nil, LifecycleClosed))

	scheme := []StatusSchemeOption{
		{Slug: "investigating", Category: LifecycleOpen},
		{Slug: "false_positive", Category: LifecycleClosed},
	}
	require.Equal(t, "investigating", FirstSlugInCategory(scheme, LifecycleOpen))
	require.Equal(t, "false_positive", FirstSlugInCategory(scheme, LifecycleClosed))
}

func TestValidateStatusScheme(t *testing.T) {
	require.NoError(t, ValidateStatusScheme(nil))
	require.NoError(t, ValidateStatusScheme(DefaultStatusScheme()))

	err := ValidateStatusScheme([]StatusSchemeOption{
		{Slug: "investigating", Name: "Investigating", Category: LifecycleOpen},
	})
	require.Error(t, err)

	err = ValidateStatusScheme([]StatusSchemeOption{
		{Slug: "Bad Slug", Name: "Investigating", Category: LifecycleOpen},
		{Slug: "closed", Name: "Closed", Category: LifecycleClosed},
	})
	require.Error(t, err)

	err = ValidateStatusScheme([]StatusSchemeOption{
		{Slug: "investigating", Name: "Investigating", Category: LifecycleOpen},
		{Slug: "investigating", Name: "Also investigating", Category: LifecycleClosed},
	})
	require.Error(t, err)

	require.NoError(t, ValidateStatusScheme([]StatusSchemeOption{
		{Slug: "investigating", Name: "Investigating", Category: LifecycleOpen},
		{Slug: "false_positive", Name: "False positive", Category: LifecycleClosed},
	}))
}
