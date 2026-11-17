// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

import {clientRunChecklistItemSlashCommand, fetchPlaybookRun} from 'src/client';
import {runCallsSlashCommand} from 'src/utils';

import Command from './command';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

const mockDispatch = jest.fn();
jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('src/hooks', () => ({
    useRun: () => [{id: 'run-id', channel_id: 'channel-id', team_id: 'team-id'}],
    useTimeout: jest.fn(),
}));

jest.mock('src/client', () => ({
    clientRunChecklistItemSlashCommand: jest.fn(),
    fetchPlaybookRun: jest.fn(),
}));

jest.mock('src/actions', () => ({
    playbookRunUpdated: (run: unknown) => ({type: 'playbook_run_updated', playbookRun: run}),
}));

jest.mock('src/utils', () => ({
    runCallsSlashCommand: jest.fn(),
}));

const mockToasterAdd = jest.fn();
jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: mockToasterAdd}),
}));

jest.mock('src/components/backstage/toast', () => ({
    ToastStyle: {Failure: 'failure'},
}));

jest.mock('src/components/dropdown', () => ({
    __esModule: true,
    default: ({target}: {target: React.ReactNode}) => <>{target}</>,
}));

jest.mock('src/components/command_input', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('src/components/widgets/text_with_tooltip_when_ellipsis', () => ({
    __esModule: true,
    default: ({text}: {text: string}) => <span>{text}</span>,
}));

jest.mock('@mattermost/shared/components/tooltip', () => ({
    WithTooltip: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

const mockRunCommand = clientRunChecklistItemSlashCommand as jest.Mock;
const mockFetchPlaybookRun = fetchPlaybookRun as jest.Mock;
const mockRunCallsSlashCommand = runCallsSlashCommand as jest.Mock;

const renderCommand = (command: string) => render(
    <Command
        playbookRunId='run-id'
        checklistNum={1}
        itemNum={2}
        itemId='item-id'
        disabled={false}
        command_last_run={0}
        command={command}
        isEditing={false}
        onChangeCommand={jest.fn()}
    />,
);

describe('Command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchPlaybookRun.mockResolvedValue({id: 'run-id'});
    });

    it('sends the displayed item with the run request', async () => {
        mockRunCommand.mockResolvedValue({});
        renderCommand('/echo Hello');

        fireEvent.click(screen.getByTestId('run'));

        await waitFor(() => expect(mockRunCommand).toHaveBeenCalledWith(
            mockDispatch,
            'run-id',
            1,
            2,
            {id: 'item-id', command: '/echo Hello'},
        ));
        expect(mockToasterAdd).not.toHaveBeenCalled();
    });

    it('warns and refreshes the run when the server reports the task changed', async () => {
        mockRunCommand.mockResolvedValue({error: {status_code: 409}});
        renderCommand('/call start');

        fireEvent.click(screen.getByTestId('run'));

        await waitFor(() => expect(mockToasterAdd).toHaveBeenCalledWith(expect.objectContaining({toastStyle: 'failure'})));
        expect(mockFetchPlaybookRun).toHaveBeenCalledWith('run-id');
        await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith({type: 'playbook_run_updated', playbookRun: {id: 'run-id'}}));
        expect(mockRunCallsSlashCommand).not.toHaveBeenCalled();
    });

    it('starts a call only after the server accepted the run', async () => {
        mockRunCommand.mockResolvedValue({});
        renderCommand('/call start');

        fireEvent.click(screen.getByTestId('run'));

        await waitFor(() => expect(mockRunCallsSlashCommand).toHaveBeenCalledWith('/call start', 'channel-id', 'team-id'));
    });

    it('does not start a call when the run request fails', async () => {
        mockRunCommand.mockResolvedValue({error: {status_code: 500}});
        renderCommand('/call start');

        fireEvent.click(screen.getByTestId('run'));

        await waitFor(() => expect(mockRunCommand).toHaveBeenCalled());
        expect(mockRunCallsSlashCommand).not.toHaveBeenCalled();
        expect(mockToasterAdd).not.toHaveBeenCalled();
    });
});
