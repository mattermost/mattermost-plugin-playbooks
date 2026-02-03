// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import {Checklist, emptyChecklistItem} from 'src/types/playbook';

import QuicklistSection from './quicklist_section';

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

describe('QuicklistSection', () => {
    const createChecklist = (title: string, itemCount: number): Checklist => ({
        id: `checklist-${title}`,
        title,
        items: Array.from({length: itemCount}, (_, i) => ({
            ...emptyChecklistItem(),
            id: `item-${i}`,
            title: `Item ${i + 1}`,
            description: `Description for item ${i + 1}`,
        })),
    });

    it('renders without crashing', () => {
        const checklist = createChecklist('Test Section', 2);
        const component = renderWithIntl(
            <QuicklistSection checklist={checklist}/>
        );
        expect(component.toJSON()).toBeTruthy();
    });

    it('displays section title', () => {
        const checklist = createChecklist('Design Phase', 3);
        const component = renderWithIntl(
            <QuicklistSection checklist={checklist}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        expect(treeStr).toContain('Design Phase');
    });

    it('displays item count', () => {
        const checklist = createChecklist('Test Section', 5);
        const component = renderWithIntl(
            <QuicklistSection checklist={checklist}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        // Should show the count badge with the data-testid and the number
        expect(treeStr).toContain('quicklist-section-count');
        expect(treeStr).toContain('"children":["5"]');
    });

    it('renders expanded by default', () => {
        const checklist = createChecklist('Test Section', 2);
        const component = renderWithIntl(
            <QuicklistSection checklist={checklist}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        // Should show the section content (items) and down chevron (expanded)
        expect(treeStr).toContain('quicklist-section-content');
        expect(treeStr).toContain('icon-chevron-down');
    });

    it('renders collapsed when defaultCollapsed is true', () => {
        const checklist = createChecklist('Test Section', 2);
        const component = renderWithIntl(
            <QuicklistSection
                checklist={checklist}
                defaultCollapsed={true}
            />
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        // Should NOT show the section content, should show right chevron (collapsed)
        expect(treeStr).not.toContain('quicklist-section-content');
        expect(treeStr).toContain('icon-chevron-right');
    });

    it('toggles collapsed state when header is clicked', () => {
        const checklist = createChecklist('Test Section', 2);
        const component = renderWithIntl(
            <QuicklistSection checklist={checklist}/>
        );

        // Initially expanded
        let tree = component.toJSON();
        let treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('quicklist-section-content');

        // Find and click the header
        const instance = component.root;
        const header = instance.findByProps({'data-testid': 'quicklist-section-header'});

        act(() => {
            header.props.onClick();
        });

        // Now should be collapsed
        tree = component.toJSON();
        treeStr = JSON.stringify(tree);
        expect(treeStr).not.toContain('quicklist-section-content');
        expect(treeStr).toContain('icon-chevron-right');

        // Click again to expand
        act(() => {
            header.props.onClick();
        });

        // Now should be expanded again
        tree = component.toJSON();
        treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('quicklist-section-content');
        expect(treeStr).toContain('icon-chevron-down');
    });

    it('renders all items when expanded', () => {
        const checklist = createChecklist('Test Section', 3);
        const component = renderWithIntl(
            <QuicklistSection checklist={checklist}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        expect(treeStr).toContain('Item 1');
        expect(treeStr).toContain('Item 2');
        expect(treeStr).toContain('Item 3');
    });

    it('returns null for sections with empty items array', () => {
        const emptyChecklist: Checklist = {
            id: 'empty-checklist',
            title: 'Empty Section',
            items: [],
        };
        const component = renderWithIntl(
            <QuicklistSection checklist={emptyChecklist}/>
        );
        const tree = component.toJSON();

        expect(tree).toBeNull();
    });

    it('returns null for sections with undefined items', () => {
        const undefinedItemsChecklist: Checklist = {
            id: 'undefined-items',
            title: 'Section with undefined items',
            items: undefined as unknown as Checklist['items'],
        };
        const component = renderWithIntl(
            <QuicklistSection checklist={undefinedItemsChecklist}/>
        );
        const tree = component.toJSON();

        expect(tree).toBeNull();
    });

    it('renders special characters in section title correctly', () => {
        const checklist: Checklist = {
            id: 'special-chars',
            title: 'Test <script>alert("xss")</script> & "quotes"',
            items: [{
                ...emptyChecklistItem(),
                id: 'item-1',
                title: 'Task 1',
            }],
        };
        const component = renderWithIntl(
            <QuicklistSection checklist={checklist}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        // Special characters should be rendered (React escapes them automatically)
        // Note: JSON.stringify escapes quotes, so we check for escaped version
        expect(treeStr).toContain('Test <script>alert');
        expect(treeStr).toContain('& \\"quotes\\"');
    });

    it('renders long section titles without breaking', () => {
        const longTitle = 'A'.repeat(200);
        const checklist: Checklist = {
            id: 'long-title',
            title: longTitle,
            items: [{
                ...emptyChecklistItem(),
                id: 'item-1',
                title: 'Task 1',
            }],
        };
        const component = renderWithIntl(
            <QuicklistSection checklist={checklist}/>
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain(longTitle);
    });
});
