// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

// AuditorService implements the Auditor interface
type AuditorService struct {
	pluginAPI pluginapi.Client
}

// NewAuditorService creates a new auditor service
func NewAuditorService(api pluginapi.Client) Auditor {
	return &AuditorService{
		pluginAPI: api,
	}
}

// MakeAuditRecord creates a new audit record
func (a *AuditorService) MakeAuditRecord(event string, initialStatus string) *model.AuditRecord {
	return plugin.MakeAuditRecord(event, initialStatus)
}

// LogAuditRec logs an audit record
func (a *AuditorService) LogAuditRec(auditRec *model.AuditRecord) {
	a.pluginAPI.Audit.Record(auditRec)
}
