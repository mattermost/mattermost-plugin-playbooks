// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {findNodeByTestId} from 'src/utils/test_helpers';

import SectionRunNaming from './section_run_naming';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

const mockToasterAdd = jest.fn();
jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: mockToasterAdd}),
}));

jest.mock('src/components/backstage/toast', () => ({
    ToastStyle: {Failure: 'failure', Success: 'success'},
}));

// TemplateInput renders ReactSelect and styled-components internals; stub it out
// so tests can focus on the prefix input and the props forwarded to TemplateInput.
jest.mock('src/components/backstage/playbook_edit/automation/template_input', () => ({
    TemplateInput: ({input, onChange, testId, enabled}: {input: string; onChange: (v: string) => void; testId?: string; enabled: boolean}) => (
        <input
            data-testid={testId ? `${testId}-input` : 'template-input'}
            data-enabled={enabled}
            value={input}
            onChange={(e) => onChange(e.target.value)}
        />
    ),
}));

// Styled-components wrappers — render as plain divs/spans so the tree is traversable
jest.mock('src/components/backstage/styles', () => ({
    BackstageSubheader: ({children}: {children: React.ReactNode}) => <div data-testid='backstage-subheader'>{children}</div>,
    BackstageSubheaderDescription: ({children}: {children: React.ReactNode}) => <span>{children}</span>,
}));

jest.mock('src/components/backstage/playbook_edit/styles', () => ({
    SidebarBlock: ({children}: {children: React.ReactNode}) => <div data-testid='sidebar-block'>{children}</div>,
}));

// BaseInput mock — plain function component avoids forwardRef out-of-scope issues in jest.mock
jest.mock('src/components/assets/inputs', () => {
    const mockBaseInput = ({onChange, onBlur, value, disabled, placeholder, 'data-testid': dataTestId}: any) => (
        <input
            data-testid={dataTestId}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={onChange}
            onBlur={onBlur}
        />
    );
    return {BaseInput: mockBaseInput};
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePlaybook = (overrides: Partial<{run_number_prefix: string; channel_name_template: string; propertyFields: any[]}> = {}) => ({
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
    run_number_prefix: '',
    channel_name_template: '',
    propertyFields: [],
    ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SectionRunNaming', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders RunNumberPrefix input with current value', () => {
        const updatePlaybook = jest.fn().mockResolvedValue({});
        const playbook = makePlaybook({run_number_prefix: 'INC-'});

        let component: renderer.ReactTestRenderer;
        act(() => {
            component = renderer.create(
                <SectionRunNaming
                    playbook={playbook as any}
                    updatePlaybook={updatePlaybook as any}
                />,
            );
        });

        const tree = component!.toJSON();
        const prefixInput = findNodeByTestId(tree, 'run-number-prefix-input');

        expect(prefixInput).not.toBeNull();
        expect(prefixInput.props.value).toBe('INC-');
    });

    it('updates prefix state when user types into the RunNumberPrefix input', () => {
        const updatePlaybook = jest.fn().mockResolvedValue({});
        const playbook = makePlaybook({run_number_prefix: ''});

        let component: renderer.ReactTestRenderer;
        act(() => {
            component = renderer.create(
                <SectionRunNaming
                    playbook={playbook as any}
                    updatePlaybook={updatePlaybook as any}
                />,
            );
        });

        act(() => {
            const inputInstance = component!.root.find(
                (node) => node.type === 'input' && node.props['data-testid'] === 'run-number-prefix-input',
            );
            inputInstance.props.onChange({target: {value: 'OPS-'}});
        });

        const inputInstance = component!.root.find(
            (node) => node.type === 'input' && node.props['data-testid'] === 'run-number-prefix-input',
        );
        expect(inputInstance.props.value).toBe('OPS-');
    });

    it('calls updatePlaybook on blur when prefix has changed', () => {
        const updatePlaybook = jest.fn().mockResolvedValue({});
        const playbook = makePlaybook({run_number_prefix: 'INC-'});

        let component: renderer.ReactTestRenderer;
        act(() => {
            component = renderer.create(
                <SectionRunNaming
                    playbook={playbook as any}
                    updatePlaybook={updatePlaybook as any}
                />,
            );
        });

        // Type a new prefix value via live root
        act(() => {
            const inputInstance = component!.root.find(
                (node) => node.type === 'input' && node.props['data-testid'] === 'run-number-prefix-input',
            );
            inputInstance.props.onChange({target: {value: 'OPS-'}});
        });

        // Blur the input — should save
        act(() => {
            const inputInstance = component!.root.find(
                (node) => node.type === 'input' && node.props['data-testid'] === 'run-number-prefix-input',
            );
            inputInstance.props.onBlur();
        });

        expect(updatePlaybook).toHaveBeenCalledTimes(1);
        expect(updatePlaybook).toHaveBeenCalledWith({runNumberPrefix: 'OPS-'});
    });

    it('does not call updatePlaybook on blur when prefix is unchanged', () => {
        const updatePlaybook = jest.fn().mockResolvedValue({});
        const playbook = makePlaybook({run_number_prefix: 'INC-'});

        let component: renderer.ReactTestRenderer;
        act(() => {
            component = renderer.create(
                <SectionRunNaming
                    playbook={playbook as any}
                    updatePlaybook={updatePlaybook as any}
                />,
            );
        });

        act(() => {
            const inputInstance = component!.root.find(
                (node) => node.type === 'input' && node.props['data-testid'] === 'run-number-prefix-input',
            );
            inputInstance.props.onBlur();
        });

        expect(updatePlaybook).not.toHaveBeenCalled();
    });

    it('renders ChannelNameTemplate (TemplateInput) with current value', () => {
        const updatePlaybook = jest.fn().mockResolvedValue({});
        const playbook = makePlaybook({channel_name_template: '{SEQ} - Incident'});

        let component: renderer.ReactTestRenderer;
        act(() => {
            component = renderer.create(
                <SectionRunNaming
                    playbook={playbook as any}
                    updatePlaybook={updatePlaybook as any}
                />,
            );
        });

        const tree = component!.toJSON();
        const templateInput = findNodeByTestId(tree, 'run-name-template-input');

        expect(templateInput).not.toBeNull();
        expect(templateInput.props.value).toBe('{SEQ} - Incident');
    });

    it('renders section as disabled when disabled prop is true', () => {
        const updatePlaybook = jest.fn().mockResolvedValue({});
        const playbook = makePlaybook({channel_name_template: 'My template'});

        let component: renderer.ReactTestRenderer;
        act(() => {
            component = renderer.create(
                <SectionRunNaming
                    playbook={playbook as any}
                    updatePlaybook={updatePlaybook as any}
                    disabled={true}
                />,
            );
        });

        const tree = component!.toJSON();

        // The TemplateInput stub receives enabled={!disabled} = false
        const templateInput = findNodeByTestId(tree, 'run-name-template-input');
        expect(templateInput).not.toBeNull();
        expect(templateInput.props['data-enabled']).toBe(false);

        // The BaseInput also receives disabled=true
        const prefixInput = findNodeByTestId(tree, 'run-number-prefix-input');
        expect(prefixInput).not.toBeNull();
        expect(prefixInput.props.disabled).toBe(true);
    });
});
