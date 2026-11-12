// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import renderer, {act} from 'react-test-renderer';

import PlaybooksSelector from './playbooks_selector';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', defaultLocale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('react-custom-scrollbars', () => ({children}: {children: ReactNode}) => (
    <div>{children}</div>
));

const mockClientFetchPlaybooks = jest.fn();
jest.mock('src/client', () => ({
    clientFetchPlaybooks: (...args: unknown[]) => mockClientFetchPlaybooks(...args),
    savePlaybook: jest.fn(),
}));

jest.mock('src/hooks', () => ({
    useHasPlaybookPermission: () => true,
}));

type ListedPlaybook = {
    id: string;
    title: string;
    description: string;
    public: boolean;
    last_run_at: number;
    active_runs: number;
    members: [];
};

const playbook = (title: string): ListedPlaybook => ({
    id: title,
    title,
    description: '',
    public: true,
    last_run_at: 0,
    active_runs: 0,
    members: [],
});

function deferred<T>() {
    let resolve: (value: T) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {
        promise,
        resolve: (value: T) => resolve(value),
        reject: (reason?: unknown) => reject(reason),
    };
}

const baseProps = {
    teamID: 'team-1',
    channelID: 'channel-1',
    searchTerm: '',
    onSelectPlaybook: jest.fn(),
};

describe('PlaybooksSelector fetch', () => {
    beforeEach(() => {
        mockClientFetchPlaybooks.mockReset();
    });

    it('drops a response after the search term changes', async () => {
        const first = deferred<{items: ListedPlaybook[]}>();
        const second = deferred<{items: ListedPlaybook[]}>();
        mockClientFetchPlaybooks.mockImplementationOnce(() => first.promise);
        mockClientFetchPlaybooks.mockImplementationOnce(() => second.promise);

        let tree: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(
                <PlaybooksSelector
                    {...baseProps}
                    searchTerm=''
                />,
            );
        });
        await act(async () => {
            tree!.update(
                <PlaybooksSelector
                    {...baseProps}
                    searchTerm='beta'
                />,
            );
        });
        await act(async () => {
            first.resolve({items: [playbook('Alpha playbook')]});
            second.resolve({items: [playbook('Beta playbook')]});
            await first.promise;
            await second.promise;
        });

        const json = JSON.stringify(tree!.toJSON());
        expect(json).toContain('Beta playbook');
        expect(json).not.toContain('Alpha playbook');
    });

    it('drops a response after unmount', async () => {
        const pending = deferred<{items: ListedPlaybook[]}>();
        mockClientFetchPlaybooks.mockReturnValue(pending.promise);

        let tree: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(<PlaybooksSelector {...baseProps}/>);
        });
        tree!.unmount();

        await act(async () => {
            pending.resolve({items: [playbook('Late playbook')]});
            await pending.promise;
        });

        expect(mockClientFetchPlaybooks).toHaveBeenCalledTimes(1);
    });

    it('clears your playbooks and shows templates when the fetch fails', async () => {
        mockClientFetchPlaybooks.mockResolvedValueOnce({items: [playbook('Alpha playbook')]});

        let tree: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(<PlaybooksSelector {...baseProps}/>);
        });
        expect(JSON.stringify(tree!.toJSON())).toContain('Alpha playbook');

        mockClientFetchPlaybooks.mockRejectedValueOnce(new Error('failed'));
        await act(async () => {
            tree!.update(
                <PlaybooksSelector
                    {...baseProps}
                    searchTerm='missing'
                />,
            );
        });

        const json = JSON.stringify(tree!.toJSON());
        expect(json).not.toContain('Alpha playbook');
        expect(json).toContain('Blank');
        expect(json).not.toContain('YOUR PLAYBOOKS');
    });
});
