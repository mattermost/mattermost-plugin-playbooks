// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const {act} = require('react');
const TestRenderer = require('react-test-renderer');

// React 19 requires act() around test-renderer mutations. Wrap the renderer so
// existing tests keep working without per-file boilerplate.
global.IS_REACT_ACT_ENVIRONMENT = true;

const originalConsoleError = console.error;
console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) {
        return;
    }
    originalConsoleError(...args);
};

const originalCreate = TestRenderer.create.bind(TestRenderer);
TestRenderer.create = (element, options) => {
    let renderer;
    act(() => {
        renderer = originalCreate(element, options);
    });
    const originalUpdate = renderer.update.bind(renderer);
    const originalUnmount = renderer.unmount.bind(renderer);
    renderer.update = (nextElement) => {
        act(() => {
            originalUpdate(nextElement);
        });
    };
    renderer.unmount = () => {
        act(() => {
            originalUnmount();
        });
    };
    return renderer;
};
