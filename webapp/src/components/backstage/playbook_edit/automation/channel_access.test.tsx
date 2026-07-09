// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

const capturedProps: Array<Record<string, unknown>> = [];

jest.mock('src/components/backstage/channel_selector', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
        capturedProps.push(props);
        return null;
    },
}));

jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => jest.fn(),
    useAppSelector: () => 'team-id',
}));

jest.mock('src/actions', () => ({
    showPlaybookActionsModal: jest.fn(),
}));

jest.mock('src/components/backstage/playbook_edit/automation/clear_indicator', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('src/components/backstage/playbook_edit/automation/menu_list', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('src/components/backstage/playbook_edit/automation/patterned_input', () => ({
    PatternedInput: () => null,
}));

import {CreateAChannel} from './channel_access';

const renderWithIntl = (children: React.ReactNode) => renderer.create(
    <IntlProvider
        locale='en'
        defaultLocale='en'
        messages={{}}
    >
        {children}
    </IntlProvider>,
);

describe('CreateAChannel — run number prefix input', () => {
    it('renders the prefix input with the value from the playbook', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: '',
            channel_name_template_override_allowed: true,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: 'INC',
            next_run_number: 1,
        };

        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
            />,
        );

        const [prefixInput] = component.root.findAll(
            (node) => node.props['data-testid'] === 'channel-access-run-number-prefix',
        );
        expect(prefixInput?.props.value).toBe('INC');
    });

    it('disables the prefix input when channel_mode is link_existing_channel', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: '',
            channel_name_template_override_allowed: true,
            delete_at: 0,
            channel_mode: 'link_existing_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
            />,
        );

        const [prefixInput] = component.root.findAll(
            (node) => node.props['data-testid'] === 'channel-access-run-number-prefix',
        );
        expect(prefixInput?.props.disabled).toBe(true);
    });

    it('calls onRunNumberPrefixChange with the new value when input changes', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: '',
            channel_name_template_override_allowed: true,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const onRunNumberPrefixChange = jest.fn();
        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
                onRunNumberPrefixChange={onRunNumberPrefixChange}
            />,
        );

        const [prefixInput] = component.root.findAll(
            (node) => node.props['data-testid'] === 'channel-access-run-number-prefix',
        );
        prefixInput.props.onChange({target: {value: 'INC'}});

        expect(onRunNumberPrefixChange).toHaveBeenCalledWith('INC');
    });
});

describe('CreateAChannel — run name template override allowed checkbox', () => {
    it('is checked when override is allowed', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: 'Incident {SEQ}',
            channel_name_template_override_allowed: true,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
            />,
        );

        const [checkbox] = component.root.findAll(
            (node) => node.props.testId === 'channel-access-run-name-template-override-allowed',
        );
        expect(checkbox?.props.checked).toBe(true);
    });

    it('is unchecked when override is not allowed', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: 'Incident {SEQ}',
            channel_name_template_override_allowed: false,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
            />,
        );

        const [checkbox] = component.root.findAll(
            (node) => node.props.testId === 'channel-access-run-name-template-override-allowed',
        );
        expect(checkbox?.props.checked).toBe(false);
    });

    it('calls onChannelNameTemplateOverrideAllowedChange with the new value when toggled', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: 'Incident {SEQ}',
            channel_name_template_override_allowed: true,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const onChannelNameTemplateOverrideAllowedChange = jest.fn();
        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
                onChannelNameTemplateOverrideAllowedChange={onChannelNameTemplateOverrideAllowedChange}
            />,
        );

        const [checkbox] = component.root.findAll(
            (node) => node.props.testId === 'channel-access-run-name-template-override-allowed',
        );
        checkbox.props.onChange(false);

        expect(onChannelNameTemplateOverrideAllowedChange).toHaveBeenCalledWith(false);
    });

    it('disables the checkbox when channel_mode is link_existing_channel', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: 'Incident {SEQ}',
            channel_name_template_override_allowed: true,
            delete_at: 0,
            channel_mode: 'link_existing_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
            />,
        );

        const [checkbox] = component.root.findAll(
            (node) => node.props.testId === 'channel-access-run-name-template-override-allowed',
        );
        expect(checkbox?.props.disabled).toBe(true);
    });

    it('disables and force-checks the checkbox when the template has no valid variable (literal template)', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: 'Incident War Room',
            channel_name_template_override_allowed: false,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
            />,
        );

        const [checkbox] = component.root.findAll(
            (node) => node.props.testId === 'channel-access-run-name-template-override-allowed',
        );
        expect(checkbox?.props.disabled).toBe(true);
        expect(checkbox?.props.checked).toBe(true);
    });

    it('disables and force-checks the checkbox when the template only has an unrecognized placeholder', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: '{notARealVariable}',
            channel_name_template_override_allowed: false,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
                fieldNames={['Zone']}
            />,
        );

        const [checkbox] = component.root.findAll(
            (node) => node.props.testId === 'channel-access-run-name-template-override-allowed',
        );
        expect(checkbox?.props.disabled).toBe(true);
        expect(checkbox?.props.checked).toBe(true);
    });

    it('keeps the checkbox enabled and respects the stored value when the template references a known property field', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: '{Zone} Incident',
            channel_name_template_override_allowed: false,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
                fieldNames={['Zone']}
            />,
        );

        const [checkbox] = component.root.findAll(
            (node) => node.props.testId === 'channel-access-run-name-template-override-allowed',
        );
        expect(checkbox?.props.disabled).toBe(false);
        expect(checkbox?.props.checked).toBe(false);
    });

    it('does not self-heal a locked, field-based template while fieldNames is still loading', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: '{Zone} Incident',
            channel_name_template_override_allowed: false,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const onChannelNameTemplateOverrideAllowedChange = jest.fn();

        // fieldNames omitted entirely — mirrors the parent's loading state before
        // fetchPlaybookPropertyFields resolves (section_actions.tsx).
        let component: ReturnType<typeof renderWithIntl>;
        act(() => {
            component = renderWithIntl(
                <CreateAChannel
                    playbook={playbook}
                    setPlaybook={jest.fn()}
                    onChannelNameTemplateOverrideAllowedChange={onChannelNameTemplateOverrideAllowedChange}
                />,
            );
        });

        expect(onChannelNameTemplateOverrideAllowedChange).not.toHaveBeenCalled();

        const [checkbox] = component!.root.findAll(
            (node) => node.props.testId === 'channel-access-run-name-template-override-allowed',
        );
        expect(checkbox?.props.disabled).toBe(false);
        expect(checkbox?.props.checked).toBe(false);
    });

    it('self-heals a stale stored false by persisting true when the template has no valid variable', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: 'Incident War Room',
            channel_name_template_override_allowed: false,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const onChannelNameTemplateOverrideAllowedChange = jest.fn();
        act(() => {
            renderWithIntl(
                <CreateAChannel
                    playbook={playbook}
                    setPlaybook={jest.fn()}
                    onChannelNameTemplateOverrideAllowedChange={onChannelNameTemplateOverrideAllowedChange}
                />,
            );
        });

        expect(onChannelNameTemplateOverrideAllowedChange).toHaveBeenCalledWith(true);
    });

    it('does not persist anything when the stored value already matches the forced display', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: 'Incident War Room',
            channel_name_template_override_allowed: true,
            delete_at: 0,
            channel_mode: 'create_new_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const onChannelNameTemplateOverrideAllowedChange = jest.fn();
        act(() => {
            renderWithIntl(
                <CreateAChannel
                    playbook={playbook}
                    setPlaybook={jest.fn()}
                    onChannelNameTemplateOverrideAllowedChange={onChannelNameTemplateOverrideAllowedChange}
                />,
            );
        });

        expect(onChannelNameTemplateOverrideAllowedChange).not.toHaveBeenCalled();
    });

    it('does not persist anything when the template is disabled (link_existing_channel)', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: 'Incident War Room',
            channel_name_template_override_allowed: false,
            delete_at: 0,
            channel_mode: 'link_existing_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const onChannelNameTemplateOverrideAllowedChange = jest.fn();
        act(() => {
            renderWithIntl(
                <CreateAChannel
                    playbook={playbook}
                    setPlaybook={jest.fn()}
                    onChannelNameTemplateOverrideAllowedChange={onChannelNameTemplateOverrideAllowedChange}
                />,
            );
        });

        expect(onChannelNameTemplateOverrideAllowedChange).not.toHaveBeenCalled();
    });
});

describe('CreateAChannel — link-existing channel selector', () => {
    beforeEach(() => {
        capturedProps.length = 0;
    });

    it('disables the channel selector and radio when newChannelOnly=true', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: '',
            channel_name_template_override_allowed: true,
            delete_at: 0,
            channel_mode: 'link_existing_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        const component = renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
                newChannelOnly={true}
            />,
        );

        const linkSelectorProps = capturedProps.find((p) => p.id === 'link_existing_channel_selector');
        expect(linkSelectorProps?.isDisabled).toBe(true);

        const [linkRadio] = component.root.findAll(
            (node) => node.props['data-testid'] === 'playbook-link-existing-channel-radio',
        );
        expect(linkRadio?.props.disabled).toBe(true);
    });

    it('passes excludeDMGM=true so DMs/GMs cannot be configured as the auto-link target for a playbook run', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: '',
            channel_name_template_override_allowed: true,
            delete_at: 0,
            channel_mode: 'link_existing_channel' as const,
            channel_id: '',
            run_number_prefix: '',
            next_run_number: 1,
        };

        renderWithIntl(
            <CreateAChannel
                playbook={playbook}
                setPlaybook={jest.fn()}
            />,
        );

        const linkSelectorProps = capturedProps.find((p) => p.id === 'link_existing_channel_selector');
        expect(linkSelectorProps).toBeDefined();
        expect(linkSelectorProps?.excludeDMGM).toBe(true);
    });
});
