// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import "github.com/pkg/errors"

// ErrNotImplemented is returned by renderer entry points whose section
// pipelines have not yet been wired up. Used during the MM-68720 → MM-68716
// staging to keep the package compilable before the section renderers land.
var ErrNotImplemented = errors.New("report renderer not yet implemented for this surface")
