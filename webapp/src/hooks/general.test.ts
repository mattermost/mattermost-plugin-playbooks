import {renderHook, act} from '@testing-library/react-hooks';
import * as redux from 'react-redux';
import {getProfilesByIds} from 'mattermost-redux/actions/users';

import {useEnsureProfile, useEnsureProfiles} from './general';

jest.mock('mattermost-redux/actions/users', () => ({
    getProfilesByIds: jest.fn(),
}));

describe('useEnsureProfile', () => {
    it('dispatches at most once for the same data', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const mockSelectFn = jest.fn();
        useSelectorSpy.mockReturnValue(mockSelectFn);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const userId = 'user1';
        const {rerender} = renderHook(() => {
            useEnsureProfile(userId);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
    });

    it('dispatches at most once for changed data', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const mockSelectFn = jest.fn();
        useSelectorSpy.mockReturnValue(mockSelectFn);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        let userId = 'user1';
        const {rerender} = renderHook(() => {
            useEnsureProfile(userId);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        userId = 'user2';
        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);

        jest.clearAllMocks();
    });

    it('dispatches only for unknown users', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const mockSelectFn = jest.fn((userId) => {
            if (userId === 'unknown') {
                return undefined;
            }

            return {id: userId};
        });
        useSelectorSpy.mockReturnValue(mockSelectFn);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const userId = 'unknown';
        const {rerender} = renderHook(() => {
            useEnsureProfile(userId);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesByIds).toHaveBeenCalledWith(['unknown']);

        jest.clearAllMocks();
    });

    it('dispatches only once for unknown users', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const mockSelectFn = jest.fn((userId) => {
            if (userId === 'unknown') {
                return undefined;
            }

            return {id: userId};
        });
        useSelectorSpy.mockReturnValue(mockSelectFn);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const userId = 'unknown';
        const {rerender} = renderHook(() => {
            useEnsureProfile(userId);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesByIds).toHaveBeenCalledTimes(1);
        expect(getProfilesByIds).toHaveBeenCalledWith(['unknown']);

        rerender();

        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesByIds).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
    });
});

describe('useEnsureProfiles', () => {
    it('dispatches at most once for the same data', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const mockSelectFn = jest.fn();
        useSelectorSpy.mockReturnValue(mockSelectFn);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const userIds = ['user1', 'user2'];
        const {rerender} = renderHook(() => {
            useEnsureProfiles(userIds);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
    });

    it('dispatches at most once for changed data', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const mockSelectFn = jest.fn();
        useSelectorSpy.mockReturnValue(mockSelectFn);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        let userIds = ['user1', 'user2'];
        const {rerender} = renderHook(() => {
            useEnsureProfiles(userIds);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        userIds = ['user1', 'user2', 'user3'];
        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);

        jest.clearAllMocks();
    });

    it('dispatches only for unknown users', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const mockSelectFn = jest.fn((userId) => {
            if (userId === 'unknown') {
                return undefined;
            }

            return {id: userId};
        });
        useSelectorSpy.mockReturnValue(mockSelectFn);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const userIds = ['user1', 'user2', 'unknown'];
        const {rerender} = renderHook(() => {
            useEnsureProfiles(userIds);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesByIds).toHaveBeenCalledWith(['unknown']);

        jest.clearAllMocks();
    });

    it('dispatches only once for unknown users', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const mockSelectFn = jest.fn((userId) => {
            if (userId === 'unknown') {
                return undefined;
            }

            return {id: userId};
        });
        useSelectorSpy.mockReturnValue(mockSelectFn);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const userIds = ['user1', 'user2', 'unknown'];
        const {rerender} = renderHook(() => {
            useEnsureProfiles(userIds);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesByIds).toHaveBeenCalledTimes(1);
        expect(getProfilesByIds).toHaveBeenCalledWith(['unknown']);

        rerender();

        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesByIds).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
    });
});
