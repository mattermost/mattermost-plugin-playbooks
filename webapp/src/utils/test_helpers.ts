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
    new_channel_only: false,
    ...overrides,
});
