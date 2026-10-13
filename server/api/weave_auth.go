// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"

	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost-plugin-playbooks/server/ops"
)

// callerFromRequest reads the session user, and the Weave ceiling when the caller is Weave.
func callerFromRequest(r *http.Request) ops.Caller {
	c := ops.Caller{Principal: r.Header.Get("Mattermost-User-ID")}
	if r.Header.Get(pluginIDHeader) != weaveCallerPluginID {
		return c
	}
	c.Invoker = r.Header.Get(weaveInvokerHeader)
	c.OwnerScope = r.Header.Get(weaveOwnerScopeHeader)
	c.RunAs = r.Header.Get(weaveRunAsHeader)
	return c
}

// rejectWeaveRun reports whether a Weave action call is outside the flow's
// ceiling. It returns true when the response has already been written.
func rejectWeaveRun(w http.ResponseWriter, r *http.Request, teamID string) bool {
	if r.Header.Get(pluginIDHeader) != weaveCallerPluginID {
		return false
	}
	if r.Header.Get(weaveRunAsHeader) == "bot" {
		http.Error(w, "bot run-as is not available for this action", http.StatusForbidden)
		return true
	}
	scope := r.Header.Get(weaveOwnerScopeHeader)
	if scope != "" && scope != "global" && teamID != "" && scope != teamID {
		http.Error(w, "this automation cannot act on another team's run", http.StatusForbidden)
		return true
	}
	return false
}

// weaveInvokerID is the user who triggered the flow when that person is not
// the principal. Empty means no extra check.
func weaveInvokerID(r *http.Request) string {
	if r.Header.Get(pluginIDHeader) != weaveCallerPluginID {
		return ""
	}
	invoker := r.Header.Get(weaveInvokerHeader)
	acting := r.Header.Get(userIDHeader)
	if invoker == "" || invoker == acting {
		return ""
	}
	return invoker
}

func (h *PlaybookRunHandler) allowWeave(w http.ResponseWriter, logger logrus.FieldLogger, r *http.Request, teamID string, allow func(invoker string) error) bool {
	if r.Header.Get(pluginIDHeader) != weaveCallerPluginID {
		return true
	}
	if rejectWeaveRun(w, r, teamID) {
		return false
	}
	invoker := weaveInvokerID(r)
	if invoker == "" {
		return true
	}
	return h.PermissionsCheck(w, logger, allow(invoker))
}

func (h *PlaybookRunHandler) allowWeaveCreate(w http.ResponseWriter, logger logrus.FieldLogger, r *http.Request, teamID, playbookID string) bool {
	if r.Header.Get(pluginIDHeader) != weaveCallerPluginID {
		return true
	}
	if rejectWeaveRun(w, r, teamID) {
		return false
	}
	invoker := weaveInvokerID(r)
	if invoker == "" || playbookID == "" {
		return true
	}
	pb, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, logger, err)
		return false
	}
	return h.PermissionsCheck(w, logger, h.permissions.RunCreate(invoker, pb, teamID))
}
