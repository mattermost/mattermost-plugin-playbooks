// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"regexp"
	"strings"

	"github.com/pkg/errors"
)

var statusSlugPattern = regexp.MustCompile(`^[a-z0-9]+(?:_[a-z0-9]+)*$`)

const (
	// StatusSlugInProgress is the default open option. Distinct from CurrentStatus
	// StatusInProgress ("InProgress"), which remains the v0 lifecycle value.
	StatusSlugInProgress = "in_progress"
	// StatusSlugClosed is the default closed option. Distinct from CurrentStatus
	// StatusFinished ("Finished").
	StatusSlugClosed = "closed"

	LifecycleOpen   = "open"
	LifecycleClosed = "closed"
)

// StatusSchemeOption is one entry in a playbook status scheme.
type StatusSchemeOption struct {
	Slug     string `json:"slug"`
	Name     string `json:"name"`
	Category string `json:"category"` // LifecycleOpen or LifecycleClosed
	Order    int    `json:"order"`
}

// DefaultStatusScheme is today's binary lifecycle, exposed as a scheme.
func DefaultStatusScheme() []StatusSchemeOption {
	return []StatusSchemeOption{
		{Slug: StatusSlugInProgress, Name: "In progress", Category: LifecycleOpen, Order: 0},
		{Slug: StatusSlugClosed, Name: "Closed", Category: LifecycleClosed, Order: 1},
	}
}

// ResolveStatusScheme returns the playbook scheme, or the implicit default when unset.
func ResolveStatusScheme(scheme []StatusSchemeOption) []StatusSchemeOption {
	if len(scheme) == 0 {
		return DefaultStatusScheme()
	}
	return scheme
}

// LifecycleFromCurrentStatus maps the stored v0 lifecycle column to the v1 name.
func LifecycleFromCurrentStatus(currentStatus string) string {
	if currentStatus == StatusFinished {
		return LifecycleClosed
	}
	return LifecycleOpen
}

// CurrentStatusFromLifecycle maps the v1 lifecycle name to the stored column.
func CurrentStatusFromLifecycle(lifecycle string) string {
	if lifecycle == LifecycleClosed {
		return StatusFinished
	}
	return StatusInProgress
}

// StatusSlugFromCurrentStatus is the backfill / default-scheme mapping.
func StatusSlugFromCurrentStatus(currentStatus string) string {
	if currentStatus == StatusFinished {
		return StatusSlugClosed
	}
	return StatusSlugInProgress
}

// CurrentStatusFromStatusSlug derives lifecycle from a scheme option's category.
func CurrentStatusFromStatusSlug(scheme []StatusSchemeOption, slug string) string {
	opt, ok := FindStatusSchemeOption(scheme, slug)
	if !ok {
		return StatusInProgress
	}
	if opt.Category == LifecycleClosed {
		return StatusFinished
	}
	return StatusInProgress
}

// FindStatusSchemeOption returns the scheme option for slug, using the implicit default when unset.
func FindStatusSchemeOption(scheme []StatusSchemeOption, slug string) (StatusSchemeOption, bool) {
	for _, opt := range ResolveStatusScheme(scheme) {
		if opt.Slug == slug {
			return opt, true
		}
	}
	return StatusSchemeOption{}, false
}

// FirstSlugInCategory returns the first option in category, or empty if none exist.
func FirstSlugInCategory(scheme []StatusSchemeOption, category string) string {
	for _, opt := range ResolveStatusScheme(scheme) {
		if opt.Category == category {
			return opt.Slug
		}
	}
	return ""
}

// ValidateStatusScheme accepts an empty scheme (implicit default) or a custom scheme with unique
// slugs and at least one open and one closed option.
func ValidateStatusScheme(scheme []StatusSchemeOption) error {
	if len(scheme) == 0 {
		return nil
	}
	if len(scheme) > 32 {
		return errors.New("status scheme cannot have more than 32 options")
	}

	seen := make(map[string]struct{}, len(scheme))
	hasOpen, hasClosed := false, false
	for i, opt := range scheme {
		name := strings.TrimSpace(opt.Name)
		slug := strings.TrimSpace(opt.Slug)
		if name == "" {
			return errors.Errorf("status scheme option %d is missing a name", i)
		}
		if !statusSlugPattern.MatchString(slug) {
			return errors.Errorf("status scheme option %q has an invalid slug", name)
		}
		if _, ok := seen[slug]; ok {
			return errors.Errorf("status scheme has duplicate slug %q", slug)
		}
		seen[slug] = struct{}{}
		switch opt.Category {
		case LifecycleOpen:
			hasOpen = true
		case LifecycleClosed:
			hasClosed = true
		default:
			return errors.Errorf("status scheme option %q has invalid category %q", name, opt.Category)
		}
	}
	if !hasOpen || !hasClosed {
		return errors.New("status scheme must include at least one open and one closed option")
	}
	return nil
}

// NormalizeStatusScheme trims fields and assigns sequential order. Empty schemes stay empty.
func NormalizeStatusScheme(scheme []StatusSchemeOption) []StatusSchemeOption {
	if len(scheme) == 0 {
		return scheme
	}
	out := make([]StatusSchemeOption, len(scheme))
	for i, opt := range scheme {
		opt.Name = strings.TrimSpace(opt.Name)
		opt.Slug = strings.TrimSpace(opt.Slug)
		opt.Order = i
		out[i] = opt
	}
	return out
}
