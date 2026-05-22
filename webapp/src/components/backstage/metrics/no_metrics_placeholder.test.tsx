// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

jest.mock('react-router-dom', () => ({
    useRouteMatch: () => ({url: '/playbooks/pb-1/reports'}),
}));

jest.mock('src/browser_routing', () => ({
    navigateToUrl: jest.fn(),
}));

jest.mock('src/components/assets/no_metrics_svg', () => ({
    __esModule: true,
    default: () => null,
}));

import NoMetricsPlaceholder from './no_metrics_placeholder';

const render = (canEdit?: boolean) =>
    renderer.create(
        <IntlProvider locale='en'>
            <NoMetricsPlaceholder {...(canEdit !== undefined ? {canEdit} : {})}/>
        </IntlProvider>,
    ).toJSON();

const hasConfigureButton = (tree: any): boolean =>
    JSON.stringify(tree).includes('Configure metrics');

describe('NoMetricsPlaceholder > canEdit prop', () => {
    it('shows the configure metrics button when canEdit=true', () => {
        expect(hasConfigureButton(render(true))).toBe(true);
    });

    it('hides the configure metrics button when canEdit=false', () => {
        expect(hasConfigureButton(render(false))).toBe(false);
    });

    it('shows the configure metrics button by default when canEdit is not provided', () => {
        expect(hasConfigureButton(render())).toBe(true);
    });
});
