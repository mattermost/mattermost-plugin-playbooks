// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import BlockTaskModal, {MAX_BLOCKED_REASON_LENGTH} from './block_task_modal';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/components/widgets/generic_modal', () => {
    const MockGenericModal = ({children, handleConfirm, isConfirmDisabled}: any) => (
        <div>
            {children}
            <button
                type='button'
                data-testid='confirm'
                disabled={isConfirmDisabled}
                onClick={handleConfirm}
            />
        </div>
    );
    return {
        __esModule: true,
        default: MockGenericModal,
        InlineLabel: ({children}: any) => <label>{children}</label>,
    };
});

jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => jest.fn(),
}));

jest.mock('src/components/backstage/profile_autocomplete', () => ({
    __esModule: true,
    default: () => null,
}));

const render = (onConfirm = jest.fn().mockResolvedValue(undefined)) => renderer.create(
    <BlockTaskModal
        taskTitle='Notify regulator'
        onConfirm={onConfirm}
        onCancel={jest.fn()}
    />,
);

const typeReason = (component: renderer.ReactTestRenderer, value: string) => {
    act(() => {
        component.root.findByProps({'data-testid': 'block-task-reason'}).props.onChange({target: {value}});
    });
};

const confirmButton = (component: renderer.ReactTestRenderer) => component.root.findByProps({'data-testid': 'confirm'});

describe('BlockTaskModal', () => {
    it('requires a reason before it can be confirmed', () => {
        const component = render();

        expect(confirmButton(component).props.disabled).toBe(true);

        typeReason(component, '   ');
        expect(confirmButton(component).props.disabled).toBe(true);

        typeReason(component, 'Waiting on legal');
        expect(confirmButton(component).props.disabled).toBe(false);
    });

    it('sends the trimmed reason', async () => {
        const onConfirm = jest.fn().mockResolvedValue(undefined);
        const component = render(onConfirm);

        typeReason(component, '  Waiting on legal  ');
        await act(async () => {
            await confirmButton(component).props.onClick();
        });

        expect(onConfirm).toHaveBeenCalledWith('Waiting on legal', []);
    });

    it('sends the people the task is blocked by', async () => {
        const onConfirm = jest.fn().mockResolvedValue(undefined);
        const component = render(onConfirm);

        typeReason(component, 'Waiting on legal');
        const picker = component.root.findByType(jest.requireMock('src/components/backstage/profile_autocomplete').default);
        act(() => {
            picker.props.setValues([{id: 'u1'}, {id: 'u2'}]);
        });
        await act(async () => {
            await confirmButton(component).props.onClick();
        });

        expect(onConfirm).toHaveBeenCalledWith('Waiting on legal', ['u1', 'u2']);
    });

    it('caps the reason at the server limit', () => {
        const component = render();

        expect(component.root.findByProps({'data-testid': 'block-task-reason'}).props.maxLength).toBe(MAX_BLOCKED_REASON_LENGTH);
    });
});
