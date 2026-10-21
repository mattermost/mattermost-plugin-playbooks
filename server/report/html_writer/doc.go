// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package html_writer renders a complete self-contained HTML report from a
// report.RenderContext or report.PlaybookRenderContext. The output is served
// from the /report.html endpoint; the client downloads it or browser-prints
// it to PDF.
package html_writer //nolint:staticcheck
