// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';

const mockApplyTheme = jest.fn();
let mockCurrentTheme = {type: 'initial-theme'};

jest.mock('mattermost-redux/selectors/entities/preferences', () => ({
    getTheme: () => mockCurrentTheme,
}));

jest.mock('src/hooks/redux', () => ({
    useAppSelector: (selector: any) => selector({}),
}));

jest.mock('src/components/backstage/css_utils', () => ({
    applyTheme: (theme: any) => mockApplyTheme(theme),
}));

jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');
    return {
        ...actual,
        useLocation: () => ({pathname: '/playbooks'}),
        useRouteMatch: () => ({url: '/playbooks'}),
    };
});

jest.mock('src/hooks', () => ({
    useForceDocumentTitle: jest.fn(),
}));

jest.mock('./toast_banner', () => ({
    ToastProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('./lhs_navigation', () => ({
    __esModule: true,
    default: () => <nav data-testid='lhs-navigation'/>,
}));

jest.mock('./main_body', () => ({
    __esModule: true,
    default: () => <main data-testid='main-body'/>,
}));

jest.mock('src/components/backstage/rhs/rhs', () => ({
    __esModule: true,
    default: () => <aside data-testid='backstage-rhs'/>,
}));

import Backstage from './backstage';

describe('Backstage', () => {
    beforeEach(() => {
        mockApplyTheme.mockClear();
        mockCurrentTheme = {type: 'initial-theme'};
        document.body.classList.remove('app__body');
    });

    afterEach(() => {
        document.body.classList.remove('app__body');
    });

    it('adds app__body on mount and leaves it on unmount', () => {
        let component!: ReturnType<typeof renderer.create>;

        expect(document.body.classList.contains('app__body')).toBe(false);

        act(() => {
            component = renderer.create(<Backstage/>);
        });

        expect(document.body.classList.contains('app__body')).toBe(true);

        act(() => {
            component.unmount();
        });

        expect(document.body.classList.contains('app__body')).toBe(true);
    });

    it('applies the selected theme on mount and when the current theme changes', () => {
        let component!: ReturnType<typeof renderer.create>;

        act(() => {
            component = renderer.create(<Backstage/>);
        });

        expect(mockApplyTheme).toHaveBeenCalledTimes(1);
        expect(mockApplyTheme).toHaveBeenCalledWith(mockCurrentTheme);

        const updatedTheme = {type: 'updated-theme'};
        mockCurrentTheme = updatedTheme;

        act(() => {
            component.update(<Backstage/>);
        });

        expect(mockApplyTheme).toHaveBeenCalledWith(updatedTheme);
        expect(mockApplyTheme).toHaveBeenCalledTimes(2);
    });
});
