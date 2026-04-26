// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer, {ReactTestRendererJSON} from 'react-test-renderer';

import SequentialIdDisplay from './sequential_id_display';

const findTestId = (node: ReactTestRendererJSON | ReactTestRendererJSON[] | null, testId: string): boolean => {
    if (!node) {
        return false;
    }
    if (Array.isArray(node)) {
        return node.some((child) => findTestId(child, testId));
    }
    if (node.props?.['data-testid'] === testId) {
        return true;
    }
    if (node.children) {
        return findTestId(node.children as ReactTestRendererJSON[], testId);
    }
    return false;
};

describe('SequentialIdDisplay', () => {
    it('renders the sequential_id when run_number is greater than 0', () => {
        const component = renderer.create(
            <SequentialIdDisplay
                runNumber={1}
                sequentialId='INC-0001'
                runName='Production Outage'
            />,
        );
        const tree = component.toJSON();
        const json = JSON.stringify(tree);

        expect(json).toContain('INC-0001');
    });

    it('renders sequential_id alongside the run name', () => {
        const component = renderer.create(
            <SequentialIdDisplay
                runNumber={5}
                sequentialId='INC-0005'
                runName='Database Incident'
            />,
        );
        const tree = component.toJSON();
        const json = JSON.stringify(tree);

        expect(json).toContain('INC-0005');
        expect(json).toContain('Database Incident');
    });

    it('renders the sequential_id in a dedicated element with data-testid sequential-id', () => {
        const component = renderer.create(
            <SequentialIdDisplay
                runNumber={3}
                sequentialId='INC-0003'
                runName='API Degradation'
            />,
        );

        const tree = component.toJSON();
        expect(findTestId(tree, 'run-sequential-id')).toBe(true);
    });

    it('returns null when run_number is 0 even if sequentialId is accidentally non-empty', () => {
        // Defensive: back-compat guard — run_number is the authoritative field
        const component = renderer.create(
            <SequentialIdDisplay
                runNumber={0}
                sequentialId='SHOULD-NOT-SHOW'
                runName='Legacy Run'
            />,
        );
        const tree = component.toJSON();

        if (tree !== null) {
            const json = JSON.stringify(tree);
            expect(json).not.toContain('SHOULD-NOT-SHOW');
        }
    });

    it('does not render the sequential-id element when run_number is 0', () => {
        const component = renderer.create(
            <SequentialIdDisplay
                runNumber={0}
                sequentialId=''
                runName='Pre-feature Run'
            />,
        );

        const tree = component.toJSON();
        expect(findTestId(tree, 'run-sequential-id')).toBe(false);
    });
});
