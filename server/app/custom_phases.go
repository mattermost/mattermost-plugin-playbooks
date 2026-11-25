// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const (
	// MaxCustomPhases and MaxCustomPhaseTitleLength bound a playbook's own phases.
	MaxCustomPhases           = 20
	MaxCustomPhaseTitleLength = 64
)

// CustomPhase is a phase a playbook defines by name, as opposed to a task list used as a phase.
// The ID keeps a phase's identity when it is renamed or moved, and is what a run's timeline refers to.
type CustomPhase struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// NormalizePhases trims the playbook's custom phases and gives each a valid, distinct ID, keeping
// the ones it already has. It returns an error describing what is wrong with them, if anything.
func (p *Playbook) NormalizePhases() error {
	if len(p.CustomPhases) > MaxCustomPhases {
		return errors.Errorf("a playbook can have at most %d phases", MaxCustomPhases)
	}

	seenTitles := make(map[string]bool, len(p.CustomPhases))
	seenIDs := make(map[string]bool, len(p.CustomPhases))
	phases := make([]CustomPhase, 0, len(p.CustomPhases))
	for _, phase := range p.CustomPhases {
		title := strings.TrimSpace(phase.Title)
		if title == "" {
			return errors.New("a phase needs a name")
		}
		if utf8.RuneCountInString(title) > MaxCustomPhaseTitleLength {
			return errors.Errorf("a phase name can have at most %d characters", MaxCustomPhaseTitleLength)
		}
		key := strings.ToLower(title)
		if seenTitles[key] {
			return errors.Errorf("there are two phases named %q", title)
		}
		seenTitles[key] = true

		id := phase.ID
		if !model.IsValidId(id) || seenIDs[id] {
			id = model.NewId()
		}
		seenIDs[id] = true
		phases = append(phases, CustomPhase{ID: id, Title: title})
	}
	p.CustomPhases = phases
	return nil
}
