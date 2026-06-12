// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {findNodeByTestId} from 'src/utils/test_helpers';

import SequentialIdDisplay from './sequential_id_display';

describe('SequentialIdDisplay', () => {
    it('renders the sequential id', () => {
        const component = renderer.create(
            <SequentialIdDisplay sequentialId='INC-0001'/>,
        );
        const tree = component.toJSON();
        expect(JSON.stringify(tree)).toContain('INC-0001');
    });

    it('renders with a data-testid of run-sequential-id', () => {
        const component = renderer.create(
            <SequentialIdDisplay sequentialId='INC-0003'/>,
        );
        expect(findNodeByTestId(component.toJSON(), 'run-sequential-id')).not.toBeNull();
    });

    it('renders a bare number (no prefix) as-is', () => {
        const component = renderer.create(
            <SequentialIdDisplay sequentialId='00001'/>,
        );
        const node = findNodeByTestId(component.toJSON(), 'run-sequential-id');
        expect(node?.children?.[0]).toBe('00001');
    });

    it('renders a 5-digit zero-padded prefixed id', () => {
        const component = renderer.create(
            <SequentialIdDisplay sequentialId='INC-00001'/>,
        );
        const tree = component.toJSON();
        expect(JSON.stringify(tree)).toContain('INC-00001');
    });

    it('renders the exact string passed without transformation', () => {
        const id = 'ABC-99999';
        const component = renderer.create(
            <SequentialIdDisplay sequentialId={id}/>,
        );
        const node = findNodeByTestId(component.toJSON(), 'run-sequential-id');
        expect(JSON.stringify(node)).toContain(id);
    });
});
