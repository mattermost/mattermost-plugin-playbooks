// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/pkg/errors"

// ErrNotFound used when an entity is not found.
var ErrNotFound = errors.New("not found")

// ErrChannelDisplayNameInvalid is used when a channel name is too long.
var ErrChannelDisplayNameInvalid = errors.New("channel name is invalid or too long")

// ErrPlaybookRunNotActive occurs when trying to run a command on a playbook run that has ended.
var ErrPlaybookRunNotActive = errors.New("already ended")

// ErrPlaybookRunActive occurs when trying to run a command on a playbook run that is active.
var ErrPlaybookRunActive = errors.New("already active")

// ErrMalformedPlaybookRun occurs when a playbook run is not valid.
var ErrMalformedPlaybookRun = errors.New("malformed")

// ErrMalformedCondition occurs when a condition is not valid.
var ErrMalformedCondition = errors.New("malformed condition")

// ErrDuplicateEntry occurs when failing to insert because the entry already existed.
var ErrDuplicateEntry = errors.New("duplicate entry")

// ErrPropertyFieldInUse occurs when trying to delete a property field that is referenced by conditions.
var ErrPropertyFieldInUse = errors.New("property field is in use")

// ErrPropertyOptionsInUse occurs when trying to remove property options that are referenced by conditions.
var ErrPropertyOptionsInUse = errors.New("property options are in use")

// ErrPropertyFieldTypeChangeNotAllowed occurs when trying to change the type of a property field that is referenced by conditions.
var ErrPropertyFieldTypeChangeNotAllowed = errors.New("property field type change not allowed")

// ErrReservedPropertyFieldName occurs when trying to create or update a property field with a reserved name.
var ErrReservedPropertyFieldName = errors.New("reserved property field name")

// ErrPropertyFieldNotOnRun occurs when a property field does not belong to the specified run.
var ErrPropertyFieldNotOnRun = errors.New("property field does not belong to run")

// ErrPlaybookArchived occurs when trying to modify an archived (deleted) playbook.
var ErrPlaybookArchived = errors.New("playbook is archived")

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

// ErrLicensedFeature if the error is caused by the server not having the needed license for the feature
var ErrLicensedFeature = errors.New("not covered by current server license")

// ErrFilterTooWide occurs when a property value filter matches more runs than the allowed maximum.
var ErrFilterTooWide = errors.New("filter matches too many results")

// ErrPropertyLimitExceeded occurs when trying to create a property field that would exceed the maximum allowed count.
var ErrPropertyLimitExceeded = errors.New("property limit exceeded")

// ErrInternalPrecondition indicates a programming contract violation — a caller
// skipped a mandatory step (e.g. calling ResolveRunCreationParams before CreatePlaybookRun).
// This maps to HTTP 500, not 400, because it is never caused by bad user input.
var ErrInternalPrecondition = errors.New("internal precondition violated")

// ErrRunNumberPrefixImmutable occurs when trying to change RunNumberPrefix on a playbook that already has runs.
var ErrRunNumberPrefixImmutable = errors.New("run_number_prefix cannot be changed once runs exist")
