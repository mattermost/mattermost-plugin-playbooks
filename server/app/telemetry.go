// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "fmt"

// GenericTelemetry is the generic interface for telemetry.
type GenericTelemetry interface {
	Page(name TelemetryPage, properties map[string]interface{})
	Track(name TelemetryTrack, properties map[string]interface{})
}

// TelemetryType is the type for the different kinds of tracking we have
type TelemetryType string

const (
	// TelemetryTypeTrack is for tracking events (click, submit, etc..)
	TelemetryTypeTrack TelemetryType = "track"
	// TelemetryTypePage is for tracking page views
	TelemetryTypePage TelemetryType = "page"
)

// TelemetryTrack is a type alias to hold all possible
// event tracking names in an enum-like
//
// Contained names should match the ones that are at webapp/src/types/telemetry.ts
// when they use generic tracking
type TelemetryTrack string

const (
	telemetryRunFollow      TelemetryTrack = "playbookrun_follow"
	telemetryRunUnfollow    TelemetryTrack = "playbookrun_unfollow"
	telemetryRunParticipate TelemetryTrack = "playbookrun_participate"
	telemetryRunLeave       TelemetryTrack = "playbookrun_leave"
)

// TelemetryPage is a type alias to hold all possible
// page tracking names in an enum-like
//
// Contained names should match the ones that are at webapp/src/types/telemetry.ts
// when they use generic tracking
type TelemetryPage string

const (
	telemetryRunStatusUpdate TelemetryPage = "run_status_update"
	telemetryRunDetails      TelemetryPage = "run_details"
)

// NewTelemetryPage creates an instance of TelemetryPage from a string.
// It's useful to validate that the arbitrary string has a equivalent constant
// for what pages we want to track (and avoid typos).
func NewTelemetryPage(name string) (TelemetryPage, error) {
	switch name {
	case string(telemetryRunStatusUpdate):
		return telemetryRunStatusUpdate, nil
	case string(telemetryRunDetails):
		return telemetryRunDetails, nil
	default:
		return "", fmt.Errorf("unknown value '%s' for type TelemetryPage", name)
	}
}

// NewTelemetryTrack creates an instance of TelemetryTrack from a string.
// It's useful to validate that the arbitrary string has a equivalent constant
// for what events we want to track (and avoid typos).
func NewTelemetryTrack(name string) (TelemetryTrack, error) {
	switch name {

	case string(telemetryRunFollow):
		return telemetryRunFollow, nil
	case string(telemetryRunUnfollow):
		return telemetryRunUnfollow, nil
	case string(telemetryRunParticipate):
		return telemetryRunParticipate, nil
	case string(telemetryRunLeave):
		return telemetryRunLeave, nil
	default:
		return "", fmt.Errorf("unknown value '%s' for type TelemetryTrack", name)
	}
}
