// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Standalone RHS refresh pub/sub so callers (e.g. playbook hooks) do not import
// rhs_main and create a circular module graph through the RHS checklist tree.

const rhsRefreshListeners = new Set<() => void>();

export function subscribeRHSRefresh(listener: () => void): () => void {
    rhsRefreshListeners.add(listener);
    return () => {
        rhsRefreshListeners.delete(listener);
    };
}

export function notifyRHSRefresh() {
    rhsRefreshListeners.forEach((listener) => listener());
}
