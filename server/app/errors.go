// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/pkg/errors"

// ErrNotFound used when an entity is not found.
var ErrNotFound = errors.New("not found")

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

// ErrOwnerGroupOnlyAction is returned when an action is blocked because the playbook's
// OwnerGroupOnlyActions flag is set and the requesting user is not the run owner or an admin.
// It wraps ErrNoPermissions so callers checking errors.Is(err, ErrNoPermissions) still match.
var ErrOwnerGroupOnlyAction = errors.Wrap(ErrNoPermissions, "action restricted to run owner or admin")

// ErrLicensedFeature if the error is caused by the server not having the needed license for the feature
var ErrLicensedFeature = errors.New("not covered by current server license")

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
