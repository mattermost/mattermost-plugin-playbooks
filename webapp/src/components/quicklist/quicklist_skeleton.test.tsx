// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';

import QuicklistSkeleton from './quicklist_skeleton';

describe('QuicklistSkeleton', () => {
    it('renders without crashing', () => {
        const component = renderer.create(<QuicklistSkeleton/>);
        expect(component.toJSON()).toBeTruthy();
    });

    it('renders default number of sections (2)', () => {
        const component = renderer.create(<QuicklistSkeleton/>);
        const tree = component.toTree();
        const sections = findAllByTestId(tree, 'quicklist-skeleton-section');
        expect(sections.length).toBe(2);
    });

    it('renders custom number of sections', () => {
        const component = renderer.create(<QuicklistSkeleton sectionCount={4}/>);
        const tree = component.toTree();
        const sections = findAllByTestId(tree, 'quicklist-skeleton-section');
        expect(sections.length).toBe(4);
    });

    it('renders default number of items per section (3)', () => {
        const component = renderer.create(<QuicklistSkeleton sectionCount={1}/>);
        const tree = component.toTree();
        const items = findAllByTestId(tree, 'quicklist-skeleton-item');
        expect(items.length).toBe(3);
    });

    it('renders custom number of items per section', () => {
        const component = renderer.create(
            <QuicklistSkeleton
                sectionCount={2}
                itemsPerSection={5}
            />
        );
        const tree = component.toTree();
        const items = findAllByTestId(tree, 'quicklist-skeleton-item');
        expect(items.length).toBe(10); // 2 sections * 5 items
    });

    it('renders thread info skeleton', () => {
        const component = renderer.create(<QuicklistSkeleton/>);
        const tree = component.toTree();
        const threadInfo = findByTestId(tree, 'quicklist-skeleton-thread-info');
        expect(threadInfo).toBeTruthy();
    });

    it('renders title skeleton', () => {
        const component = renderer.create(<QuicklistSkeleton/>);
        const tree = component.toTree();
        const title = findByTestId(tree, 'quicklist-skeleton-title');
        expect(title).toBeTruthy();
    });

    it('renders with main container test id', () => {
        const component = renderer.create(<QuicklistSkeleton/>);
        const tree = component.toTree();
        const container = findByTestId(tree, 'quicklist-skeleton');
        expect(container).toBeTruthy();
    });
});

// Helper functions to find components by test id
function findByTestId(tree: renderer.ReactTestRendererTree | null, testId: string): renderer.ReactTestRendererTree | null {
    if (!tree) {
        return null;
    }

    if (tree.props && tree.props['data-testid'] === testId) {
        return tree;
    }

    if (tree.rendered) {
        if (Array.isArray(tree.rendered)) {
            for (const child of tree.rendered) {
                const found = findByTestId(child as renderer.ReactTestRendererTree, testId);
                if (found) {
                    return found;
                }
            }
        } else {
            return findByTestId(tree.rendered as renderer.ReactTestRendererTree, testId);
        }
    }

    return null;
}

function findAllByTestId(tree: renderer.ReactTestRendererTree | null, testId: string): renderer.ReactTestRendererTree[] {
    const results: renderer.ReactTestRendererTree[] = [];

    function search(node: renderer.ReactTestRendererTree | null) {
        if (!node) {
            return;
        }

        if (node.props && node.props['data-testid'] === testId) {
            results.push(node);
        }

        if (node.rendered) {
            if (Array.isArray(node.rendered)) {
                for (const child of node.rendered) {
                    search(child as renderer.ReactTestRendererTree);
                }
            } else {
                search(node.rendered as renderer.ReactTestRendererTree);
            }
        }
    }

    search(tree);
    return results;
}
