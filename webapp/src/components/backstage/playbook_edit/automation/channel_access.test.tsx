// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
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

describe('CreateAChannel — link-existing channel selector', () => {
    beforeEach(() => {
        capturedProps.length = 0;
    });

    it('disables the channel selector and radio when newChannelOnly=true', () => {
        const playbook = {
            create_public_playbook_run: true,
            channel_name_template: '',
            delete_at: 0,
            channel_mode: 'link_existing_channel' as const,
            channel_id: '',
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
            delete_at: 0,
            channel_mode: 'link_existing_channel' as const,
            channel_id: '',
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
