// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';

import RHSParticipants from './rhs_participants';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,

        // The formatjs babel plugin pre-compiles defaultMessage into an ICU AST, so
        // defer to the real formatMessage implementation to resolve it to text.
        FormattedMessage: (descriptor: {defaultMessage: string}) => <span>{intl.formatMessage(descriptor)}</span>,
    };
});

jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => jest.fn(),
    useAppSelector: () => null,
}));

jest.mock('src/components/rhs/rhs_participant', () => ({
    RHSParticipant: () => null,
    Rest: () => null,
}));

describe('RHSParticipants', () => {
    it('hides add participant controls when canAddParticipants is false', () => {
        const component = renderer.create(
            <RHSParticipants
                userIds={['user-1']}
                setShowParticipants={jest.fn()}
                canAddParticipants={false}
            />,
        );
        expect(component.root.findAllByProps({'data-testid': 'rhs-add-participant-icon'})).toHaveLength(0);
    });

    it('shows add participant controls when canAddParticipants is true', () => {
        const component = renderer.create(
            <RHSParticipants
                userIds={['user-1']}
                setShowParticipants={jest.fn()}
                canAddParticipants={true}
            />,
        );
        expect(component.root.findAllByProps({'data-testid': 'rhs-add-participant-icon'}).length).toBeGreaterThan(0);
    });

    it('hides the "Add participant" link and "Become a participant" icon on a finished run with no participants', () => {
        // Mirrors how rhs_about.tsx wires RHSParticipants for a finished run:
        // onParticipate is undefined and canAddParticipants is false.
        const component = renderer.create(
            <MemoryRouter>
                <RHSParticipants
                    userIds={[]}
                    setShowParticipants={jest.fn()}
                    canAddParticipants={false}
                />
            </MemoryRouter>,
        );
        expect(component.root.findAllByProps({'data-testid': 'rhs-participate-icon'})).toHaveLength(0);
        const links = component.root.findAll((node) => node.type === 'a' && node.props.children?.[0] === 'Add participant');
        expect(links).toHaveLength(0);
    });

    it('shows the "Add participant" link when canAddParticipants is true and there are no participants', () => {
        const component = renderer.create(
            <MemoryRouter>
                <RHSParticipants
                    userIds={[]}
                    setShowParticipants={jest.fn()}
                    canAddParticipants={true}
                />
            </MemoryRouter>,
        );
        const links = component.root.findAll((node) => node.type === 'a' && node.props.children?.[0] === 'Add participant');
        expect(links.length).toBeGreaterThan(0);
    });
});
