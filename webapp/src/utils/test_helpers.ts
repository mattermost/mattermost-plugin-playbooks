// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Recursively searches a react-test-renderer JSON tree for a node whose
 * data-testid prop matches testId. Returns the first matching node or null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const findNodeByTestId = (node: any, testId: string): any => {
    if (!node) {
        return null;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const result = findNodeByTestId(child, testId);
            if (result) {
                return result;
            }
        }
        return null;
    }
    if (node.props?.['data-testid'] === testId) {
        return node;
    }
    if (node.children) {
        return findNodeByTestId(node.children, testId);
    }
    return null;
};
