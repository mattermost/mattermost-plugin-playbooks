import {renderHook} from '@testing-library/react-hooks';
import * as redux from 'react-redux';
import {getProfilesByIds, getProfilesInChannel, getProfilesInTeam} from 'mattermost-redux/actions/users';

import {PROFILE_CHUNK_SIZE} from 'src/constants';

import {
    clearLocks,
    useEnsureProfile,
    useEnsureProfiles,
    useProfilesInChannel,
    useProfilesInCurrentChannel,
    useProfilesInTeam,
} from './general';

jest.mock('mattermost-redux/actions/users', () => ({
    getProfilesByIds: jest.fn(),
    getProfilesInTeam: jest.fn(),
    getProfilesInChannel: jest.fn(),
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

describe('useProfilesInTeam', () => {
    it('dispatches if no team members have been loaded', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInCurrentTeam = [] as String[];
        const currentTeamId = 'team_id';

        let calls = 0;

        useSelectorSpy.mockImplementation(() => {
            // since useSelector is called twice, we mock one return value, then the other.
            if (calls++ % 2 === 0) {
                return profilesInCurrentTeam;
            }
            return currentTeamId;
        });

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInTeam();
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInTeam).toHaveBeenCalledWith('team_id', 0, PROFILE_CHUNK_SIZE);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
        clearLocks();
    });

    it('dispatches if the current team changes', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInCurrentTeam = [] as String[];
        let currentTeamId = 'team_id';

        let calls = 0;
        useSelectorSpy.mockImplementation(() => {
            // since useSelector is called twice, we mock one return value, then the other.
            if (calls++ % 2 === 0) {
                return profilesInCurrentTeam;
            }
            return currentTeamId;
        });

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInTeam();
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInTeam).toHaveBeenCalledWith('team_id', 0, PROFILE_CHUNK_SIZE);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        currentTeamId = 'new_team_id';
        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);
        expect(getProfilesInTeam).toHaveBeenCalledWith('new_team_id', 0, PROFILE_CHUNK_SIZE);

        jest.clearAllMocks();
        clearLocks();
    });

    it('does not dispatch after loading team members', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        let profilesInCurrentTeam = [] as String[];
        const currentTeamId = 'team_id';

        let calls = 0;
        useSelectorSpy.mockImplementation(() => {
            // since useSelector is called twice, we mock one return value, then the other.
            if (calls++ % 2 === 0) {
                return profilesInCurrentTeam;
            }
            return currentTeamId;
        });

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInTeam();
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInTeam).toHaveBeenCalledWith('team_id', 0, PROFILE_CHUNK_SIZE);

        profilesInCurrentTeam = ['user_1', 'user_2'];
        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
        clearLocks();
    });

    it('does not dispatch if team members are already loaded', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInCurrentTeam = ['user_1', 'user_2'];
        const currentTeamId = 'team_id';

        let calls = 0;
        useSelectorSpy.mockImplementation(() => {
            // since useSelector is called twice, we mock one return value, then the other.
            if (calls++ % 2 === 0) {
                return profilesInCurrentTeam;
            }
            return currentTeamId;
        });

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInTeam();
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(0);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(0);

        jest.clearAllMocks();
        clearLocks();
    });

    it('does not dispatch if already fetching', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInCurrentTeam = [] as String[];
        let currentTeamId = 'team_id';

        let calls = 0;
        useSelectorSpy.mockImplementation(() => {
            // since useSelector is called twice, we mock one return value, then the other.
            if (calls++ % 2 === 0) {
                return profilesInCurrentTeam;
            }
            return currentTeamId;
        });

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender: rerender1} = renderHook(() => {
            useProfilesInTeam();
        });
        const {rerender: rerender2} = renderHook(() => {
            useProfilesInTeam();
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInTeam).toHaveBeenCalledWith('team_id', 0, PROFILE_CHUNK_SIZE);

        rerender1();
        rerender2();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        currentTeamId = 'new_team_id';
        rerender1();
        rerender2();
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);
        expect(getProfilesInTeam).toHaveBeenCalledWith('new_team_id', 0, PROFILE_CHUNK_SIZE);

        jest.clearAllMocks();
        clearLocks();
    });
});

describe('useProfilesInCurrentChannel', () => {
    it('dispatches if no channel members have been loaded', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInChannel = [] as String[];
        const currentChannelId = 'channel_id';

        let calls = 0;
        useSelectorSpy.mockImplementation(() => {
            // since useSelector is called twice, we mock one return value, then the other.
            if (calls++ % 2 === 0) {
                return currentChannelId;
            }
            return profilesInChannel;
        });

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInCurrentChannel();
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInChannel).toHaveBeenCalledWith('channel_id', 0, PROFILE_CHUNK_SIZE);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
        clearLocks();
    });

    it('dispatches if the channel changes', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInChannel = [] as String[];
        let currentChannelId = 'channel_id';

        let calls = 0;
        useSelectorSpy.mockImplementation(() => {
            // since useSelector is called twice, we mock one return value, then the other.
            if (calls++ % 2 === 0) {
                return currentChannelId;
            }
            return profilesInChannel;
        });

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInCurrentChannel();
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInChannel).toHaveBeenCalledWith('channel_id', 0, PROFILE_CHUNK_SIZE);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        currentChannelId = 'new_channel_id';
        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);
        expect(getProfilesInChannel).toHaveBeenCalledWith('new_channel_id', 0, PROFILE_CHUNK_SIZE);

        jest.clearAllMocks();
        clearLocks();
    });

    it('does not dispatch after loading channel members', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        let profilesInChannel = [] as String[];
        const currentChannelId = 'channel_id';

        let calls = 0;
        useSelectorSpy.mockImplementation(() => {
            // since useSelector is called twice, we mock one return value, then the other.
            if (calls++ % 2 === 0) {
                return currentChannelId;
            }
            return profilesInChannel;
        });

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInCurrentChannel();
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInChannel).toHaveBeenCalledWith('channel_id', 0, PROFILE_CHUNK_SIZE);

        profilesInChannel = ['user_1', 'user_2'];
        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
        clearLocks();
    });

    it('does not dispatch if channel members are already loaded', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInChannel = ['user_1', 'user_2'];
        const currentChannelId = 'channel_id';

        let calls = 0;
        useSelectorSpy.mockImplementation(() => {
            // since useSelector is called twice, we mock one return value, then the other.
            if (calls++ % 2 === 0) {
                return currentChannelId;
            }
            return profilesInChannel;
        });

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInCurrentChannel();
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(0);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(0);

        jest.clearAllMocks();
        clearLocks();
    });

    it('does not dispatch if already fetching', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInChannel = [] as String[];
        let currentChannelId = 'channel_id';

        let calls = 0;
        useSelectorSpy.mockImplementation(() => {
            // since useSelector is called twice, we mock one return value, then the other.
            if (calls++ % 2 === 0) {
                return currentChannelId;
            }
            return profilesInChannel;
        });

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender: rerender1} = renderHook(() => {
            useProfilesInCurrentChannel();
        });
        const {rerender: rerender2} = renderHook(() => {
            useProfilesInCurrentChannel();
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInChannel).toHaveBeenCalledWith('channel_id', 0, PROFILE_CHUNK_SIZE);

        rerender1();
        rerender2();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        currentChannelId = 'new_channel_id';
        rerender1();
        rerender2();
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);
        expect(getProfilesInChannel).toHaveBeenCalledWith('new_channel_id', 0, PROFILE_CHUNK_SIZE);

        jest.clearAllMocks();
        clearLocks();
    });
});

describe('useProfilesInChannel', () => {
    it('dispatches if no channel members have been loaded', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInChannel = [] as String[];
        const channelId = 'channel_id';

        useSelectorSpy.mockReturnValue(profilesInChannel);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInChannel(channelId);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInChannel).toHaveBeenCalledWith('channel_id', 0, PROFILE_CHUNK_SIZE);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
        clearLocks();
    });

    it('dispatches if the channel changes', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInChannel = [] as String[];
        let channelId = 'channel_id';

        useSelectorSpy.mockReturnValue(profilesInChannel);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInChannel(channelId);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInChannel).toHaveBeenCalledWith('channel_id', 0, PROFILE_CHUNK_SIZE);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        channelId = 'new_channel_id';
        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);
        expect(getProfilesInChannel).toHaveBeenCalledWith('new_channel_id', 0, PROFILE_CHUNK_SIZE);

        jest.clearAllMocks();
        clearLocks();
    });

    it('does not dispatch after loading channel members', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        let profilesInChannel = [] as String[];
        const channelId = 'channel_id';

        useSelectorSpy.mockReturnValue(profilesInChannel);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInChannel(channelId);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);
        expect(getProfilesInChannel).toHaveBeenCalledWith('channel_id', 0, PROFILE_CHUNK_SIZE);

        profilesInChannel = ['user_1', 'user_2'];
        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
        clearLocks();
    });

    it('does not dispatch if channel members are already loaded', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInChannel = ['user_1', 'user_2'];
        const channelId = 'channel_id';

        useSelectorSpy.mockReturnValue(profilesInChannel);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender} = renderHook(() => {
            useProfilesInChannel(channelId);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(0);

        rerender();
        expect(mockDispatchFn).toHaveBeenCalledTimes(0);

        jest.clearAllMocks();
        clearLocks();
    });

    it('does not dispatch if already fetching', async () => {
        const useSelectorSpy = jest.spyOn(redux, 'useSelector');
        const profilesInChannel = [] as String[];
        let channelId = 'channel_id';
        const channelId2 = 'channel_id2';

        useSelectorSpy.mockReturnValue(profilesInChannel);

        const useDispatchSpy = jest.spyOn(redux, 'useDispatch');
        const mockDispatchFn = jest.fn();
        useDispatchSpy.mockReturnValue(mockDispatchFn);

        const {rerender: rerender1} = renderHook(() => {
            useProfilesInChannel(channelId);
        });
        const {rerender: rerender2} = renderHook(() => {
            useProfilesInChannel(channelId);
        });
        const {rerender: rerender3} = renderHook(() => {
            useProfilesInChannel(channelId2);
        });
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);
        expect(getProfilesInChannel).toHaveBeenCalledWith('channel_id', 0, PROFILE_CHUNK_SIZE);
        expect(getProfilesInChannel).toHaveBeenCalledWith('channel_id2', 0, PROFILE_CHUNK_SIZE);

        rerender1();
        rerender2();
        rerender3();
        expect(mockDispatchFn).toHaveBeenCalledTimes(2);

        channelId = 'new_channel_id';
        rerender1();
        rerender2();
        rerender3();
        expect(mockDispatchFn).toHaveBeenCalledTimes(3);
        expect(getProfilesInChannel).toHaveBeenCalledWith('new_channel_id', 0, PROFILE_CHUNK_SIZE);

        jest.clearAllMocks();
        clearLocks();
    });
});
