// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';
import configureStore from 'redux-mock-store';

import {openQuicklistModal} from 'src/actions';

import {QuicklistPostMenuText, makeQuicklistPostAction} from './post_menu';

jest.mock('src/actions', () => ({
    addToTimeline: jest.fn(() => ({type: 'MOCK_ADD_TO_TIMELINE'})),
    openQuicklistModal: jest.fn(() => ({type: 'MOCK_OPEN_QUICKLIST_MODAL'})),
    showPostMenuModal: jest.fn(() => ({type: 'MOCK_SHOW_POST_MENU_MODAL'})),
    startPlaybookRun: jest.fn(() => ({type: 'MOCK_START_PLAYBOOK_RUN'})),
}));

const mockOpenQuicklistModal = openQuicklistModal as jest.Mock;
const mockStore = configureStore();

const renderWithIntl = (component: React.ReactElement) => {
    return renderer.create(
        <IntlProvider
            locale='en'
            messages={{}}
        >
            {component}
        </IntlProvider>
    );
};

describe('QuicklistPostMenuText', () => {
    it('renders without crashing', () => {
        const component = renderWithIntl(<QuicklistPostMenuText/>);
        expect(component.toJSON()).toBeTruthy();
    });

    it('displays correct text', () => {
        const component = renderWithIntl(<QuicklistPostMenuText/>);
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        expect(treeStr).toContain('Generate checklist with AI');
    });

    it('includes PlaybookRunPostMenuIcon', () => {
        const component = renderWithIntl(<QuicklistPostMenuText/>);
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        expect(Array.isArray(tree)).toBe(true);
        if (Array.isArray(tree)) {
            expect(tree.length).toBe(2);
        }
    });
});

describe('makeQuicklistPostAction', () => {
    const regularPost = {
        id: 'post-123',
        channel_id: 'channel-456',
        user_id: 'user-789',
        message: 'Hello world',
        type: '',
        props: {},
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
        edit_at: 0,
        is_pinned: false,
        root_id: '',
        original_id: '',
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {},
    };

    const systemPost = {
        ...regularPost,
        id: 'system-post-123',
        type: 'system_join_channel',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('action', () => {
        it('calls openQuicklistModal with correct postId and channelId', () => {
            const store = mockStore({
                entities: {
                    posts: {
                        posts: {
                            'post-123': regularPost,
                        },
                    },
                },
            });

            const action = makeQuicklistPostAction(store);
            action.action('post-123');

            expect(mockOpenQuicklistModal).toHaveBeenCalledTimes(1);
            expect(mockOpenQuicklistModal).toHaveBeenCalledWith('post-123', 'channel-456');
            expect(store.getActions()).toContainEqual({type: 'MOCK_OPEN_QUICKLIST_MODAL'});
        });

        it('does nothing when post is not found', () => {
            const store = mockStore({
                entities: {
                    posts: {
                        posts: {},
                    },
                },
            });

            const action = makeQuicklistPostAction(store);
            action.action('non-existent-post');

            expect(mockOpenQuicklistModal).not.toHaveBeenCalled();
            expect(store.getActions()).toHaveLength(0);
        });
    });

    describe('filter', () => {
        it('returns true for regular posts', () => {
            const store = mockStore({
                entities: {
                    posts: {
                        posts: {
                            'post-123': regularPost,
                        },
                    },
                },
            });

            const action = makeQuicklistPostAction(store);
            const result = action.filter('post-123');

            expect(result).toBe(true);
        });

        it('returns false for system messages', () => {
            const store = mockStore({
                entities: {
                    posts: {
                        posts: {
                            'system-post-123': systemPost,
                        },
                    },
                },
            });

            const action = makeQuicklistPostAction(store);
            const result = action.filter('system-post-123');

            expect(result).toBe(false);
        });

        it('returns false for non-existent posts', () => {
            const store = mockStore({
                entities: {
                    posts: {
                        posts: {},
                    },
                },
            });

            const action = makeQuicklistPostAction(store);
            const result = action.filter('non-existent-post');

            expect(result).toBe(false);
        });
    });

    describe('text', () => {
        it('returns QuicklistPostMenuText component', () => {
            const store = mockStore({});
            const action = makeQuicklistPostAction(store);

            expect(action.text).toBe(QuicklistPostMenuText);
        });
    });
});
