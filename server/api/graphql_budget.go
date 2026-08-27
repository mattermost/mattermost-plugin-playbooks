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

// recordBudget tracks the records a single GraphQL request has claimed. Capacity
// is claimed before a listing is fetched rather than charged afterwards: fields
// resolve in parallel, so admitting a listing on the records hydrated so far
// would let concurrent fields read the same remaining capacity and exceed the
// limit together.
type recordBudget struct {
	limit int64
	used  atomic.Int64
}

// reserve claims capacity for the n records a listing may return, erroring
// unless the whole page fits in what the request has left.
func (b *recordBudget) reserve(n int) error {
	if n <= 0 {
		return nil
	}

	for {
		used := b.used.Load()
		if used+int64(n) > b.limit {
			return newGraphQLError(errors.Errorf("query exceeds the limit of %d records per request", b.limit))
		}

		if b.used.CompareAndSwap(used, used+int64(n)) {
			return nil
		}
	}
}

// release returns capacity a listing reserved but did not use, so that a request
// asking for a large page and matching few records keeps its budget for the
// fields it has left to resolve.
func (b *recordBudget) release(n int) {
	if n > 0 {
		b.used.Add(-int64(n))
	}
}
