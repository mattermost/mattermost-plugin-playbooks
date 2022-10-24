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
type TelemetryTrack int

const (
	telemetryRunFollow TelemetryTrack = iota
	telemetryRunUnfollow
	telemetryRunParticipate
	telemetryRunLeave
	telemetryRunUpdateActions
)

var trackTypes = [...]string{
	telemetryRunFollow:        "playbookrun_follow",
	telemetryRunUnfollow:      "playbookrun_unfollow",
	telemetryRunParticipate:   "playbookrun_participate",
	telemetryRunLeave:         "playbookrun_leave",
	telemetryRunUpdateActions: "playbookrun_update_actions",
}

// String creates the string version of the TelemetryTrack
func (tt TelemetryTrack) String() string {
	return trackTypes[tt]
}

// TelemetryPage is a type alias to hold all possible
// page tracking names in an enum-like
//
// Contained names should match the ones that are at webapp/src/types/telemetry.ts
// when they use generic tracking
type TelemetryPage int

const (
	telemetryRunStatusUpdate TelemetryPage = iota
	telemetryRunDetails
)

var pageTypes = [...]string{
	telemetryRunStatusUpdate: "run_status_update",
	telemetryRunDetails:      "run_details",
}

// String creates the string version of the Telemetrypage
func (tp TelemetryPage) String() string {
	return pageTypes[tp]
}

// NewTelemetryPage creates an instance of TelemetryPage from a string.
// It's useful to validate that the arbitrary string has a equivalent constant
// for what pages we want to track (and avoid typos).
func NewTelemetryPage(name string) (*TelemetryPage, error) {
	for i, ct := range pageTypes {
		if ct == name {
			tp := TelemetryPage(i)
			return &tp, nil
		}
	}
	return nil, fmt.Errorf("unknown page type: %s", name)
}

// NewTelemetryTrack creates an instance of TelemetryTrack from a string.
// It's useful to validate that the arbitrary string has a equivalent constant
// for what events we want to track (and avoid typos).
func NewTelemetryTrack(name string) (*TelemetryTrack, error) {
	for i, ct := range trackTypes {
		if ct == name {
			tt := TelemetryTrack(i)
			return &tt, nil
		}
	}
	return nil, fmt.Errorf("unknown track type: %s", name)
}
