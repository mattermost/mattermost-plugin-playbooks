// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import QuicklistErrorBoundary from './quicklist_error_boundary';

// Component that throws an error for testing
const ErrorThrowingComponent = ({shouldThrow}: {shouldThrow: boolean}) => {
    if (shouldThrow) {
        throw new Error('Test error');
    }

    // eslint-disable-next-line formatjs/no-literal-string-in-jsx
    return <div data-testid='child-content'>{'Child content'}</div>;
};

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

const getTreeString = (component: renderer.ReactTestRenderer): string => {
    return JSON.stringify(component.toJSON());
};

describe('QuicklistErrorBoundary', () => {
    // Suppress console.error for error boundary tests
    let originalError: typeof console.error;

    beforeAll(() => {
        // eslint-disable-next-line no-console
        originalError = console.error;

        // eslint-disable-next-line no-console
        console.error = jest.fn();
    });

    afterAll(() => {
        // eslint-disable-next-line no-console
        console.error = originalError;
    });

    it('renders children when there is no error', () => {
        const component = renderWithIntl(
            <QuicklistErrorBoundary>
                <ErrorThrowingComponent shouldThrow={false}/>
            </QuicklistErrorBoundary>,
        );

        const treeStr = getTreeString(component);
        expect(treeStr).toContain('child-content');
        expect(treeStr).toContain('Child content');
    });

    it('renders fallback UI when an error is thrown', () => {
        const component = renderWithIntl(
            <QuicklistErrorBoundary>
                <ErrorThrowingComponent shouldThrow={true}/>
            </QuicklistErrorBoundary>,
        );

        const treeStr = getTreeString(component);
        expect(treeStr).toContain('quicklist-error-boundary');
        expect(treeStr).toContain('Something went wrong');
    });

    it('shows retry button in fallback UI', () => {
        const component = renderWithIntl(
            <QuicklistErrorBoundary>
                <ErrorThrowingComponent shouldThrow={true}/>
            </QuicklistErrorBoundary>,
        );

        const treeStr = getTreeString(component);
        expect(treeStr).toContain('quicklist-error-boundary-retry');
        expect(treeStr).toContain('Try Again');
    });

    it('calls onReset when retry button is clicked', () => {
        const onReset = jest.fn();

        const component = renderWithIntl(
            <QuicklistErrorBoundary onReset={onReset}>
                <ErrorThrowingComponent shouldThrow={true}/>
            </QuicklistErrorBoundary>,
        );

        // Find and click the retry button
        const tree = component.toTree() as renderer.ReactTestRendererTree;
        const findButton = (node: renderer.ReactTestRendererTree | null): renderer.ReactTestRendererTree | null => {
            if (!node) {
                return null;
            }
            if (node.props && node.props['data-testid'] === 'quicklist-error-boundary-retry') {
                return node;
            }
            if (node.rendered) {
                if (Array.isArray(node.rendered)) {
                    for (const child of node.rendered) {
                        const found = findButton(child as renderer.ReactTestRendererTree);
                        if (found) {
                            return found;
                        }
                    }
                } else {
                    return findButton(node.rendered as renderer.ReactTestRendererTree);
                }
            }
            return null;
        };

        const button = findButton(tree);
        expect(button).toBeTruthy();

        act(() => {
            button?.props?.onClick?.();
        });

        expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('logs error to console', () => {
        renderWithIntl(
            <QuicklistErrorBoundary>
                <ErrorThrowingComponent shouldThrow={true}/>
            </QuicklistErrorBoundary>,
        );

        // eslint-disable-next-line no-console
        expect(console.error).toHaveBeenCalled();
    });
});
