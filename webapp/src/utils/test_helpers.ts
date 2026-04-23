// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared base playbook fixture for toggle component tests.
 * Pass field overrides to set the field under test.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeBasePlaybook = <T extends Record<string, any>>(overrides: T = {} as T) => ({
    id: 'playbook-1',
    title: 'Test Playbook',
    description: '',
    team_id: 'team-1',
    public: true,
    create_public_playbook_run: false,
    delete_at: 0,
    num_stages: 0,
    num_steps: 0,
    num_runs: 0,
    num_actions: 0,
    last_run_at: 0,
    members: [],
    default_playbook_member_role: '',
    active_runs: 0,
    default_owner_id: '',
    default_owner_enabled: false,
    run_summary_template_enabled: false,
    ...overrides,
});

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
