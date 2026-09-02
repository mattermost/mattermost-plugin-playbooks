// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import RequirementsAccordion from './requirements_accordion';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

const requirements = [
    {id: 'r1', label: 'Ticket URL', value: ''},
    {id: 'r2', label: 'Root cause', value: 'filled'},
];

describe('RequirementsAccordion', () => {
    it('returns null when there are no requirements', () => {
        const component = renderer.create(
            <RequirementsAccordion requirements={[]}/>,
        );
        expect(component.toJSON()).toBeNull();
    });

    it('shows Complete when incomplete and no values filled', () => {
        const onComplete = jest.fn();
        const component = renderer.create(
            <RequirementsAccordion
                requirements={[{id: 'r1', label: 'Ticket URL', value: ''}]}
                isTaskComplete={false}
                onComplete={onComplete}
                onEditValues={jest.fn()}
            />,
        );

        const complete = component.root.findByProps({'data-testid': 'complete-requirement-values'});
        expect(complete).toBeTruthy();
        expect(() => component.root.findByProps({'data-testid': 'edit-requirement-values'})).toThrow();

        act(() => {
            complete.props.onClick();
        });
        expect(onComplete).toHaveBeenCalled();
    });

    it('hides Complete and shows Edit when any field is filled', () => {
        const component = renderer.create(
            <RequirementsAccordion
                requirements={requirements}
                isTaskComplete={false}
                onComplete={jest.fn()}
                onEditValues={jest.fn()}
            />,
        );

        expect(() => component.root.findByProps({'data-testid': 'complete-requirement-values'})).toThrow();
        expect(component.root.findByProps({'data-testid': 'edit-requirement-values'})).toBeTruthy();
    });
});
