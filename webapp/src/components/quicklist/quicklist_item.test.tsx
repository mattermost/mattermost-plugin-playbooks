// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';
import {DateTime} from 'luxon';

import {ChecklistItem, emptyChecklistItem} from 'src/types/playbook';

import QuicklistItem from './quicklist_item';

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

describe('QuicklistItem', () => {
    const createItem = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
        ...emptyChecklistItem(),
        id: 'test-item-id',
        title: 'Test Task',
        ...overrides,
    });

    it('renders without crashing', () => {
        const item = createItem();
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        expect(component.toJSON()).toBeTruthy();
    });

    it('displays item title', () => {
        const item = createItem({title: 'Complete the design mockups'});
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        expect(treeStr).toContain('Complete the design mockups');
    });

    it('displays item description when present', () => {
        const item = createItem({
            title: 'Test Task',
            description: 'This is a detailed description of the task',
        });
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        expect(treeStr).toContain('This is a detailed description of the task');
        expect(treeStr).toContain('quicklist-item-description');
    });

    it('does not display description when empty', () => {
        const item = createItem({
            title: 'Test Task',
            description: '',
        });
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        expect(treeStr).not.toContain('quicklist-item-description');
    });

    it('displays due date when present', () => {
        // Set due date to Jan 15, 2024
        const dueDate = DateTime.fromObject({year: 2024, month: 1, day: 15}).toMillis();
        const item = createItem({
            title: 'Test Task',
            due_date: dueDate,
        });
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        expect(treeStr).toContain('quicklist-item-due-date');
        expect(treeStr).toContain('Jan');
        expect(treeStr).toContain('15');
    });

    it('does not display due date when zero', () => {
        const item = createItem({
            title: 'Test Task',
            due_date: 0,
        });
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        expect(treeStr).not.toContain('quicklist-item-due-date');
    });

    it('displays checkbox icon', () => {
        const item = createItem();
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        expect(treeStr).toContain('icon-checkbox-blank-outline');
    });

    it('renders all elements together correctly', () => {
        const dueDate = DateTime.fromObject({year: 2024, month: 3, day: 20}).toMillis();
        const item = createItem({
            title: 'Review pull request',
            description: 'Check for code quality and test coverage',
            due_date: dueDate,
        });
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        expect(treeStr).toContain('Review pull request');
        expect(treeStr).toContain('Check for code quality and test coverage');
        expect(treeStr).toContain('quicklist-item-due-date');
        expect(treeStr).toContain('Mar');
        expect(treeStr).toContain('20');
    });

    it('renders special characters in title correctly', () => {
        const item = createItem({
            title: 'Test <script>alert("xss")</script> & "quotes"',
        });
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        // React automatically escapes special characters, verify they are present
        // Note: JSON.stringify escapes quotes, so we check for escaped version
        expect(treeStr).toContain('Test <script>alert');
        expect(treeStr).toContain('& \\"quotes\\"');
    });

    it('renders special characters in description correctly', () => {
        const item = createItem({
            title: 'Test Task',
            description: 'Description with <html> tags & special "chars"',
        });
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);

        // Note: JSON.stringify escapes quotes, so we check for escaped version
        expect(treeStr).toContain('Description with <html> tags');
        expect(treeStr).toContain('& special \\"chars\\"');
    });

    it('renders long titles without breaking', () => {
        const longTitle = 'A'.repeat(500);
        const item = createItem({
            title: longTitle,
        });
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain(longTitle);
    });

    it('renders long descriptions without breaking', () => {
        const longDescription = 'B'.repeat(1000);
        const item = createItem({
            title: 'Test Task',
            description: longDescription,
        });
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain(longDescription);
    });

    it('renders unbroken long strings (no spaces) without breaking', () => {
        // Simulate a very long URL or code snippet with no spaces
        const unbrokenString = 'https://example.com/' + 'a'.repeat(300) + '/path/to/resource';
        const item = createItem({
            title: 'Task with long URL',
            description: unbrokenString,
        });
        const component = renderWithIntl(
            <QuicklistItem item={item}/>
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain(unbrokenString);
    });
});
