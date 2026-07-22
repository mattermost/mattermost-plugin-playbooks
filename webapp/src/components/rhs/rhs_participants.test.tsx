// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';

import RHSParticipants from './rhs_participants';

// The formatjs babel plugin precompiles `defaultMessage` into an AST
// (array of {type, value} nodes) rather than a plain string. Flatten it
// back into a string so these mocks can be used directly as React children.
function mockFlattenDefaultMessage(descriptor: {defaultMessage: unknown}): string {
    const raw = descriptor.defaultMessage;
    if (typeof raw === 'string') {
        return raw;
    }
    if (Array.isArray(raw)) {
        return raw.map((part: unknown) => (typeof part === 'string' ? part : (part as {value?: string}).value ?? '')).join('');
    }
    return String(raw);
}

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    return {
        ...reactIntl,
        useIntl: () => ({formatMessage: mockFlattenDefaultMessage}),
        FormattedMessage: (props: {defaultMessage: unknown}) => mockFlattenDefaultMessage(props as {defaultMessage: unknown}),
    };
});

jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn(),
    useSelector: () => null,
}));

jest.mock('src/components/rhs/rhs_participant', () => ({
    RHSParticipant: () => null,
    Rest: () => null,
}));

const renderWithRouter = (element: React.ReactElement) => renderer.create(
    <MemoryRouter>
        {element}
    </MemoryRouter>,
);

describe('RHSParticipants', () => {
    it('hides add participant icon control when canAddParticipants is false', () => {
        const component = renderWithRouter(
            <RHSParticipants
                userIds={['user-1']}
                setShowParticipants={jest.fn()}
                canAddParticipants={false}
            />,
        );
        expect(component.root.findAllByProps({'data-testid': 'rhs-add-participant-icon'})).toHaveLength(0);
    });

    it('shows add participant icon control when canAddParticipants is true', () => {
        const component = renderWithRouter(
            <RHSParticipants
                userIds={['user-1']}
                setShowParticipants={jest.fn()}
                canAddParticipants={true}
            />,
        );
        expect(component.root.findAllByProps({'data-testid': 'rhs-add-participant-icon'}).length).toBeGreaterThan(0);
    });

    it('defaults to showing add participant icon control when canAddParticipants is not provided', () => {
        const component = renderWithRouter(
            <RHSParticipants
                userIds={['user-1']}
                setShowParticipants={jest.fn()}
            />,
        );
        expect(component.root.findAllByProps({'data-testid': 'rhs-add-participant-icon'}).length).toBeGreaterThan(0);
    });

    it('hides add participant link (empty state) when canAddParticipants is false', () => {
        const component = renderWithRouter(
            <RHSParticipants
                userIds={[]}
                setShowParticipants={jest.fn()}
                canAddParticipants={false}
            />,
        );
        expect(component.root.findAllByType('a')).toHaveLength(0);
    });

    it('shows add participant link (empty state) when canAddParticipants is true', () => {
        const component = renderWithRouter(
            <RHSParticipants
                userIds={[]}
                setShowParticipants={jest.fn()}
                canAddParticipants={true}
            />,
        );
        expect(component.root.findAllByType('a').length).toBeGreaterThan(0);
    });

    it('hides the become-a-participant control when onParticipate is not provided, even if canAddParticipants is true', () => {
        const component = renderWithRouter(
            <RHSParticipants
                userIds={['user-1']}
                setShowParticipants={jest.fn()}
                canAddParticipants={true}
            />,
        );
        expect(component.root.findAllByProps({'data-testid': 'rhs-participate-icon'})).toHaveLength(0);
    });

    it('shows the become-a-participant control when onParticipate is provided, regardless of canAddParticipants', () => {
        const component = renderWithRouter(
            <RHSParticipants
                userIds={['user-1']}
                setShowParticipants={jest.fn()}
                onParticipate={jest.fn()}
                canAddParticipants={false}
            />,
        );
        expect(component.root.findAllByProps({'data-testid': 'rhs-participate-icon'}).length).toBeGreaterThan(0);
        expect(component.root.findAllByProps({'data-testid': 'rhs-add-participant-icon'})).toHaveLength(0);
    });
});
