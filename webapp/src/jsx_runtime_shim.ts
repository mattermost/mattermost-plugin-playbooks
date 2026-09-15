// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Mattermost v12 hosts that still ship React 18 do not expose window.ReactJSXRuntime.
// React 19 hosts do. Provide a createElement-backed fallback so the automatic JSX
// transform can load in either case. Must be the first webpack entry.

type JsxRuntime = {
    Fragment: unknown;
    jsx: (type: unknown, config: Record<string, unknown> | null, maybeKey?: unknown) => unknown;
    jsxs: (type: unknown, config: Record<string, unknown> | null, maybeKey?: unknown) => unknown;
};

declare global {
    interface Window {
        React?: {
            Fragment: unknown;
            createElement: (type: unknown, props: unknown) => unknown;
        };
        ReactJSXRuntime?: JsxRuntime;
        ReactJSXDevRuntime?: JsxRuntime;
    }
}

const react = window.React;
if (react && !window.ReactJSXRuntime) {
    const jsx: JsxRuntime['jsx'] = (type, config, maybeKey) => {
        const props: Record<string, unknown> = {};
        if (config) {
            for (const name of Object.keys(config)) {
                if (name === 'key') {
                    continue;
                }
                props[name] = config[name];
            }
        }
        const key = maybeKey ?? config?.key;
        if (key !== undefined && key !== null) {
            props.key = String(key);
        }
        return react.createElement(type, props);
    };

    const runtime: JsxRuntime = {
        Fragment: react.Fragment,
        jsx,
        jsxs: jsx,
    };

    window.ReactJSXRuntime = runtime;
    if (!window.ReactJSXDevRuntime) {
        window.ReactJSXDevRuntime = runtime;
    }
}
