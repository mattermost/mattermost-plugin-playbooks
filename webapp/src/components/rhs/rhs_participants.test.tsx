// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import RHSParticipants from './rhs_participants';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
        FormattedMessage: ({defaultMessage}: {defaultMessage: string}) => defaultMessage,
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
});
