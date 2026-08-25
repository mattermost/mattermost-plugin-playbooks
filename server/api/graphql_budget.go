// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"sync/atomic"

	"github.com/pkg/errors"
)

// maxRecordsPerRequest bounds how many playbook and run records a single GraphQL
// request may hydrate across every field it resolves. Neither MaxDepth nor the
// request body limit constrains breadth, so repeating a list field under distinct
// aliases would otherwise multiply the work of one small request without bound.
const maxRecordsPerRequest = 5000

// recordBudget tracks the records hydrated so far by a single GraphQL request.
// Fields resolve in parallel, so the running total is kept atomically.
type recordBudget struct {
	limit int64
	used  atomic.Int64
}

// check reports an error once previously resolved fields have used up the
// request's budget, stopping an over-budget request before it hydrates more.
func (b *recordBudget) check() error {
	if b.used.Load() >= b.limit {
		return newGraphQLError(errors.Errorf("query exceeds the limit of %d records per request", b.limit))
	}

	return nil
}

// record charges n hydrated records against the budget. Charging what was
// actually fetched rather than the requested page size keeps requests that ask
// for a large page but match few records from being rejected.
func (b *recordBudget) record(n int) {
	b.used.Add(int64(n))
}
