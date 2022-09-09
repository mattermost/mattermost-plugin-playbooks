// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "fmt"

type TelemetryTrack string

// TelemetryPage is a type alias to hold all possible
// page tracking names in an enum-like
//
// Contained names should match the ones that are at webapp/src/types/telemetry.ts
// when they use generic tracking
type TelemetryPage string

const (
	telemetryRunStatusUpdate TelemetryPage = "run_status_update"
)

// NewTelemetryPage creates an instance of TelemetryPage from a string.
// It's useful to validate that the arbitrary string has a equivalent constant
// for what pages we want to track (and avoid typos).
func NewTelemetryPage(name string) (TelemetryPage, error) {
	switch name {
	case string(telemetryRunStatusUpdate):
		return telemetryRunStatusUpdate, nil
	default:
		return "", fmt.Errorf("unknown value '%s' for type TelemetryPage", name)
	}
}

// NewTelemetryTrack creates an instance of TelemetryTrack from a string.
// It's useful to validate that the arbitrary string has a equivalent constant
// for what events we want to track (and avoid typos).
func NewTelemetryTrack(name string) (TelemetryTrack, error) {
	switch name {
	// New events should be added here
	default:
		return "", fmt.Errorf("unknown value '%s' for type TelemetryTrack", name)
	}
}

// TelemetryType is the type for the different kinds of tracking we have
type TelemetryType string

const (
	// TelemetryTypeTrack is for tracking events (click, submit, etc..)
	TelemetryTypeTrack TelemetryType = "track"
	// TelemetryTypePage is for tracking page views
	TelemetryTypePage TelemetryType = "page"
)
