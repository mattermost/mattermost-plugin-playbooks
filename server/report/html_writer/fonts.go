// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html_writer

// systemFontCSS returns CSS @font-face–free font stacks that use OS-installed
// fonts. No font files are bundled; Gotenberg's Chromium container ships with
// Liberation / DejaVu / Noto families that cover these stacks. Browser-print
// fallback path uses whatever the OS provides, which is fine for all modern
// desktop/mobile OSes.
func systemFontCSS() string {
	return `
:root {
  --font-sans:  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  --font-mono:  "SFMono-Regular", Consolas, "Liberation Mono", Menlo,
                Courier, monospace;
}
body { font-family: var(--font-sans); }
code, pre { font-family: var(--font-mono); }
`
}
