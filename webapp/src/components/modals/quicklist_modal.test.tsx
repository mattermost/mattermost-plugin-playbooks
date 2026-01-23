// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import QuicklistModal, {makeModalDefinition} from './quicklist_modal';

// Mock the GenericModal to simplify testing
jest.mock('src/components/widgets/generic_modal', () => {
    return function MockGenericModal({children, ...props}: any) {
        return (
            <div
                data-testid='mock-generic-modal'
                data-props={JSON.stringify(props)}
            >
                {children}
            </div>
        );
    };
});

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

describe('QuicklistModal', () => {
    const defaultProps = {
        postId: 'test-post-id',
        channelId: 'test-channel-id',
        onHide: jest.fn(),
    };

    it('renders without crashing', () => {
        const component = renderWithIntl(
            <QuicklistModal {...defaultProps}/>
        );
        expect(component.toJSON()).toBeTruthy();
    });

    it('displays loading state initially', () => {
        const component = renderWithIntl(
            <QuicklistModal {...defaultProps}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        // Should contain the loading spinner and text
        expect(treeStr).toContain('quicklist-loading');
        expect(treeStr).toContain('Analyzing thread...');
    });

    it('has confirm button disabled during loading', () => {
        const component = renderWithIntl(
            <QuicklistModal {...defaultProps}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        // The modal should have isConfirmDisabled set to true (escaped in nested JSON)
        expect(treeStr).toContain('isConfirmDisabled');
        expect(treeStr).toMatch(/isConfirmDisabled[^}]*true/);
    });
});

describe('makeModalDefinition', () => {
    it('returns correct modal definition', () => {
        const props = {
            postId: 'test-post-id',
            channelId: 'test-channel-id',
            onHide: jest.fn(),
        };

        const definition = makeModalDefinition(props);

        expect(definition.modalId).toBe('playbooks_quicklist_modal');
        expect(definition.dialogType).toBe(QuicklistModal);
        expect(definition.dialogProps).toEqual(props);
    });
});
