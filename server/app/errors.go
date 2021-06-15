package app

import "github.com/pkg/errors"

// ErrNotFound used to indicate entity not found.
var ErrNotFound = errors.New("not found")

// ErrChannelDisplayNameInvalid is used to indicate a channel name is too long.
var ErrChannelDisplayNameInvalid = errors.New("channel name is invalid or too long")

// ErrPermission is used to indicate a user does not have permissions
var ErrPermission = errors.New("permissions error")

// ErrIncidentNotActive is used to indicate trying to run a command on an incident that has ended.
var ErrIncidentNotActive = errors.New("incident not active")

// ErrIncidentActive is used to indicate trying to run a command on an incident that is active.
var ErrIncidentActive = errors.New("incident active")

// ErrMalformedIncident is used to indicate an incident is not valid
var ErrMalformedIncident = errors.New("incident active")

// ErrDuplicateEntry indicates the db could not make an insert because the entry already existed.
var ErrDuplicateEntry = errors.New("duplicate entry")
