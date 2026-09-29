// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx, react/jsx-no-literals */

import React, {act} from 'react';
import renderer from 'react-test-renderer';

import {ToastProvider, useToaster} from './toast_banner';

const Trigger = () => {
    const {add} = useToaster();
    return (
        <button
            type='button'
            onClick={() => add({content: 'Successfully duplicated playbook', duration: 0})}
        >
            show
        </button>
    );
};

describe('ToastProvider', () => {
    it('renders an added toast without using findDOMNode', () => {
        let tree!: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <ToastProvider>
                    <Trigger/>
                </ToastProvider>,
            );
        });

        act(() => {
            tree.root.findByType('button').props.onClick();
        });

        expect(JSON.stringify(tree.toJSON())).toContain('Successfully duplicated playbook');
    });
});
