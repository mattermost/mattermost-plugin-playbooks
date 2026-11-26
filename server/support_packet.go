// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"path/filepath"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"

	"github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type SupportPacket struct {
	Version string `yaml:"version"`

	// Error lists the queries that failed while generating this file. The fields
	// those queries fill are left at their zero value. The error goes here rather
	// than to the server, because the server drops a plugin's files when the
	// support data hook returns an error.
	Error string `yaml:"error,omitempty"`

	// The schema version of the plugin's database tables, and the version this plugin
	// release migrates them to. A difference means migrations failed or didn't finish.
	DatabaseSchemaVersion       string `yaml:"database_schema_version"`
	DatabaseSchemaLatestVersion string `yaml:"database_schema_latest_version"`

	// The total number of playbooks.
	TotalPlaybooks int64 `yaml:"total_playbooks"`
	// The number of active playbooks.
	ActivePlaybooks int64 `yaml:"active_playbooks"`

	// The total number of playbook runs.
	TotalPlaybookRuns int64 `yaml:"total_playbook_runs"`
	// The number of playbook runs per status.
	InProgressPlaybookRuns int64 `yaml:"in_progress_playbook_runs"`
	FinishedPlaybookRuns   int64 `yaml:"finished_playbook_runs"`

	// The size of runs. Very large runs are a common cause of slow loading.
	// The participant stats only cover runs with at least one participant.
	MaxChecklistItemsPerRun int64   `yaml:"max_checklist_items_per_run"`
	AvgChecklistItemsPerRun float64 `yaml:"avg_checklist_items_per_run"`
	MaxParticipantsPerRun   int64   `yaml:"max_participants_per_run"`
	AvgParticipantsPerRun   float64 `yaml:"avg_participants_per_run"`
}

func (p *Plugin) GenerateSupportData(_ *plugin.Context) ([]*model.FileData, error) {
	var result *multierror.Error
	check := func(err error, what string) {
		if err != nil {
			result = multierror.Append(result, errors.Wrapf(err, "failed to get %s", what))
		}
	}

	schemaVersion, err := p.statsStore.SchemaVersion()
	check(err, "database schema version")

	totalPlaybooks, err := p.statsStore.TotalPlaybooks()
	check(err, "total number of playbooks")

	activePlaybooks, err := p.playbookStore.GetPlaybooksActiveTotal()
	check(err, "number of active playbooks")

	runCounts, err := p.statsStore.PlaybookRunCountsByStatus()
	check(err, "number of playbook runs")

	checklistItems, err := p.statsStore.ChecklistItemsPerRun()
	check(err, "checklist items per run")

	participants, err := p.statsStore.ParticipantsPerRun()
	check(err, "participants per run")

	diagnostics := SupportPacket{
		Version:                     manifest.Version,
		DatabaseSchemaVersion:       schemaVersion,
		DatabaseSchemaLatestVersion: sqlstore.LatestVersion().String(),
		TotalPlaybooks:              int64(totalPlaybooks),
		ActivePlaybooks:             activePlaybooks,
		TotalPlaybookRuns:           runCounts.Total,
		InProgressPlaybookRuns:      runCounts.InProgress,
		FinishedPlaybookRuns:        runCounts.Finished,
		MaxChecklistItemsPerRun:     checklistItems.Max,
		AvgChecklistItemsPerRun:     checklistItems.Avg,
		MaxParticipantsPerRun:       participants.Max,
		AvgParticipantsPerRun:       participants.Avg,
	}

	if err := result.ErrorOrNil(); err != nil {
		logrus.WithError(err).Warn("Failed to collect some Playbooks diagnostics for the Support Packet")
		diagnostics.Error = err.Error()
	}

	body, err := yaml.Marshal(diagnostics)
	if err != nil {
		// No file to report into, so this one has to go to the server.
		return nil, errors.Wrap(err, "Failed to marshal diagnostics")
	}

	return []*model.FileData{{
		Filename: filepath.Join(manifest.Id, "diagnostics.yaml"),
		Body:     body,
	}}, nil
}
