// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {generateId} from 'mattermost-redux/utils/helpers';

import EditRequirementsModal from './edit_requirements_modal';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('mattermost-redux/utils/helpers', () => ({
    generateId: jest.fn(() => 'generated-id'),
}));

jest.mock('src/components/widgets/generic_modal', () => {
    return function MockGenericModal({
        children,
        handleConfirm,
        isConfirmDisabled,
    }: {
        children: React.ReactNode;
        handleConfirm?: () => void;
        isConfirmDisabled?: boolean;
    }) {
        return (
            <div data-testid='edit-requirements-modal'>
                {children}
                <button
                    type='button'
                    data-testid='modal-confirm'
                    disabled={isConfirmDisabled}
                    onClick={handleConfirm}
                />
            </div>
        );
    };
});

describe('EditRequirementsModal', () => {
    beforeEach(() => {
        let n = 0;
        (generateId as jest.Mock).mockImplementation(() => {
            n += 1;
            return `generated-id-${n}`;
        });
    });

    it('disables save when adding with empty labels', () => {
        const onConfirm = jest.fn();
        const component = renderer.create(
            <EditRequirementsModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
            />,
        );

        expect(component.root.findByProps({'data-testid': 'modal-confirm'}).props.disabled).toBe(true);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('adds and saves a requirement label', () => {
        const onConfirm = jest.fn();
        const component = renderer.create(
            <EditRequirementsModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
            />,
        );

        act(() => {
            component.root.findByProps({'data-testid': 'requirement-label-input'}).props.onChange({
                target: {value: 'Ticket URL'},
            });
        });

        act(() => {
            component.root.findByProps({'data-testid': 'modal-confirm'}).props.onClick();
        });

        expect(onConfirm).toHaveBeenCalledWith([{
            id: 'generated-id-1',
            label: 'Ticket URL',
            value: '',
        }]);
    });

    it('preserves existing values when editing labels', () => {
        const onConfirm = jest.fn();
        const component = renderer.create(
            <EditRequirementsModal
                initialRequirements={[
                    {id: 'req-1', label: 'Old label', value: 'https://example.com'},
                ]}
                onConfirm={onConfirm}
                onCancel={jest.fn()}
            />,
        );

        act(() => {
            component.root.findByProps({'data-testid': 'requirement-label-input'}).props.onChange({
                target: {value: 'New label'},
            });
        });

        act(() => {
            component.root.findByProps({'data-testid': 'modal-confirm'}).props.onClick();
        });

        expect(onConfirm).toHaveBeenCalledWith([{
            id: 'req-1',
            label: 'New label',
            value: 'https://example.com',
        }]);
    });

    it('allows clearing all requirements when editing', () => {
        const onConfirm = jest.fn();
        const component = renderer.create(
            <EditRequirementsModal
                initialRequirements={[
                    {id: 'req-1', label: 'Ticket URL', value: 'abc'},
                ]}
                onConfirm={onConfirm}
                onCancel={jest.fn()}
            />,
        );

        act(() => {
            component.root.findByProps({'data-testid': 'requirement-label-input'}).props.onChange({
                target: {value: '   '},
            });
        });

        expect(component.root.findByProps({'data-testid': 'modal-confirm'}).props.disabled).toBe(false);

        act(() => {
            component.root.findByProps({'data-testid': 'modal-confirm'}).props.onClick();
        });

        expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it('can add another requirement draft', () => {
        const component = renderer.create(
            <EditRequirementsModal
                onConfirm={jest.fn()}
                onCancel={jest.fn()}
            />,
        );

        act(() => {
            component.root.findByProps({'data-testid': 'add-another-requirement'}).props.onClick();
        });

        expect(component.root.findAllByProps({'data-testid': 'requirement-label-input'}).length +
            component.root.findAllByProps({'data-testid': 'requirement-label-input-1'}).length).toBeGreaterThanOrEqual(2);
        expect(component.root.findByProps({'data-testid': 'requirement-label-input-1'})).toBeTruthy();
    });
});
