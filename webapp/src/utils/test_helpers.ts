// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Playbook} from 'src/types/playbook';

export const makeBasePlaybook = (overrides: Partial<Playbook> = {}): Playbook => ({
    id: 'test-playbook-id',
    title: 'Test Playbook',
    description: '',
    team_id: 'test-team-id',
    create_public_playbook_run: false,
    delete_at: 0,
    run_summary_template_enabled: false,
    public: true,
    default_owner_id: '',
    default_owner_enabled: false,
    num_stages: 0,
    num_steps: 0,
    num_runs: 0,
    num_actions: 0,
    last_run_at: 0,
    members: [],
    default_playbook_member_role: 'playbook_member',
    active_runs: 0,
    admin_only_edit: false,
    ...overrides,
});

export const findNodeByTestId = (tree: any, testId: string): any => {
    if (!tree) {
        return null;
    }
    if (Array.isArray(tree)) {
        for (const child of tree) {
            const found = findNodeByTestId(child, testId);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (tree.props?.['data-testid'] === testId) {
        return tree;
    }
    if (tree.children) {
        return findNodeByTestId(tree.children, testId);
    }
    return null;
};
