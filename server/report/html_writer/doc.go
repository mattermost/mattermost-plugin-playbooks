// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package html_writer renders a complete self-contained HTML report from a
// report.RenderContext or report.PlaybookRenderContext. The output is served
// verbatim from the /report.html endpoint and is also the input to the
// Gotenberg PDF adapter — single source of truth for visual fidelity.
package html_writer
