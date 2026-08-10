// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import FillRequirementsModal from './fill_requirements_modal';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/components/widgets/generic_modal', () => {
    return function MockGenericModal({children, footer}: {children: React.ReactNode; footer?: React.ReactNode}) {
        return (
            <div data-testid='fill-requirements-modal'>
                {children}
                {footer}
            </div>
        );
    };
});

jest.mock('src/components/assets/buttons', () => ({
    PrimaryButton: ({children, onClick, disabled, ...rest}: any) => (
        <button
            type='button'
            onClick={onClick}
            disabled={disabled}
            {...rest}
        >
            {children}
        </button>
    ),
    TertiaryButton: ({children, onClick, disabled, ...rest}: any) => (
        <button
            type='button'
            onClick={onClick}
            disabled={disabled}
            {...rest}
        >
            {children}
        </button>
    ),
}));

const requirements = [
    {id: 'r1', label: 'Ticket URL', value: ''},
    {id: 'r2', label: 'Root cause', value: ''},
];

describe('FillRequirementsModal', () => {
    it('Save allows partial values', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        const onSaveAndComplete = jest.fn().mockResolvedValue(undefined);
        const component = renderer.create(
            <FillRequirementsModal
                taskTitle='My task'
                requirements={requirements}
                onSave={onSave}
                onSaveAndComplete={onSaveAndComplete}
                onCancel={jest.fn()}
            />,
        );

        const input = component.root.findByProps({'data-testid': 'requirement-value-r1'});
        act(() => {
            input.props.onChange({target: {value: 'https://example.com'}});
        });

        const save = component.root.findByProps({'data-testid': 'modal-save-requirements'});
        await act(async () => {
            await save.props.onClick();
        });

        expect(onSave).toHaveBeenCalledWith({r1: 'https://example.com', r2: ''});
        expect(onSaveAndComplete).not.toHaveBeenCalled();
    });

    it('Save and mark complete shows errors when fields are empty', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        const onSaveAndComplete = jest.fn().mockResolvedValue(undefined);
        const component = renderer.create(
            <FillRequirementsModal
                taskTitle='My task'
                requirements={requirements}
                onSave={onSave}
                onSaveAndComplete={onSaveAndComplete}
                onCancel={jest.fn()}
            />,
        );

        const complete = component.root.findByProps({'data-testid': 'modal-save-and-complete'});
        await act(async () => {
            await complete.props.onClick();
        });

        expect(onSaveAndComplete).not.toHaveBeenCalled();
        expect(component.root.findByProps({'data-testid': 'requirement-error-r1'})).toBeTruthy();
        expect(component.root.findByProps({'data-testid': 'requirement-error-r2'})).toBeTruthy();
    });

    it('Save and mark complete succeeds when all fields are filled', async () => {
        const onSaveAndComplete = jest.fn().mockResolvedValue(undefined);
        const component = renderer.create(
            <FillRequirementsModal
                taskTitle='My task'
                requirements={requirements}
                onSave={jest.fn().mockResolvedValue(undefined)}
                onSaveAndComplete={onSaveAndComplete}
                onCancel={jest.fn()}
            />,
        );

        act(() => {
            component.root.findByProps({'data-testid': 'requirement-value-r1'}).props.onChange({target: {value: 'url'}});
            component.root.findByProps({'data-testid': 'requirement-value-r2'}).props.onChange({target: {value: 'cause'}});
        });

        await act(async () => {
            await component.root.findByProps({'data-testid': 'modal-save-and-complete'}).props.onClick();
        });

        expect(onSaveAndComplete).toHaveBeenCalledWith({r1: 'url', r2: 'cause'});
    });

    it('keeps modal open when Save rejects', async () => {
        const onSave = jest.fn().mockRejectedValue(new Error('network'));
        const component = renderer.create(
            <FillRequirementsModal
                taskTitle='My task'
                requirements={requirements}
                onSave={onSave}
                onSaveAndComplete={jest.fn().mockResolvedValue(undefined)}
                onCancel={jest.fn()}
            />,
        );

        await act(async () => {
            await component.root.findByProps({'data-testid': 'modal-save-requirements'}).props.onClick();
        });

        expect(onSave).toHaveBeenCalled();
        expect(component.root.findByProps({'data-testid': 'fill-requirements-modal'})).toBeTruthy();
        expect(component.root.findByProps({'data-testid': 'modal-save-requirements'}).props.disabled).toBe(false);
    });
});
