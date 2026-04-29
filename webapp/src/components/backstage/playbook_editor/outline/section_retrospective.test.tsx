// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import SectionRetrospective from './section_retrospective';

const renderWithIntl = (element: React.ReactElement) => renderer.create(
    <IntlProvider locale='en'>{element}</IntlProvider>,
);

jest.mock('src/hooks', () => ({
    useAllowRetrospectiveAccess: () => true,
    usePlaybookAttributes: () => [],
}));

jest.mock('src/graphql/hooks', () => ({
    useUpdatePlaybook: () => jest.fn(),
}));

jest.mock('src/client', () => ({
    savePlaybook: jest.fn(),
}));

jest.mock('src/components/backstage/playbook_edit/metrics/metrics', () => ({
    __esModule: true,
    default: () => <div data-testid='metrics'/>,
}));

jest.mock('src/components/markdown_edit', () => ({
    __esModule: true,
    default: () => <div data-testid='markdown-edit'/>,
}));

jest.mock('src/components/backstage/playbook_editor/outline/inputs/retrospective_interval_selector', () => ({
    __esModule: true,
    default: () => <div data-testid='retrospective-interval-selector'/>,
}));

const makePlaybook = (overrides: Record<string, unknown> = {}): any => ({
    id: 'playbook-1',
    retrospective_enabled: true,
    retrospective_reminder_interval_seconds: 86400,
    retrospective_template: '',
    delete_at: 0,
    checklists: [],
    ...overrides,
});

describe('SectionRetrospective', () => {
    it('renders the placeholder and no input controls when retrospective_enabled is false', () => {
        const playbook = makePlaybook({retrospective_enabled: false});

        const tree = renderWithIntl(
            <SectionRetrospective
                playbook={playbook}
                refetch={jest.fn()}
            />,
        ).toJSON();

        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('A retrospective is not expected.');
        expect(treeStr).not.toContain('retrospective-interval-selector');
        expect(treeStr).not.toContain('retrospective-metrics');
        expect(treeStr).not.toContain('Retrospective template');
    });

    it('renders input controls when retrospective_enabled is true', () => {
        const playbook = makePlaybook({retrospective_enabled: true});

        const tree = renderWithIntl(
            <SectionRetrospective
                playbook={playbook}
                refetch={jest.fn()}
            />,
        ).toJSON();

        const treeStr = JSON.stringify(tree);
        expect(treeStr).not.toContain('A retrospective is not expected.');
        expect(treeStr).toContain('retrospective-interval-selector');
        expect(treeStr).toContain('retrospective-metrics');
    });
});
