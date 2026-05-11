// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

// Track the most-recently rendered handleConfirm so tests can trigger it.
let capturedHandleConfirm: (() => void) | undefined;

jest.mock('src/components/widgets/generic_modal', () => {
    const ReactImpl = jest.requireActual('react');
    const MockGenericModal = (props: {handleConfirm?: () => void; children: React.ReactNode}) => {
        capturedHandleConfirm = props.handleConfirm;
        return ReactImpl.createElement('div', {'data-testid': 'mock-generic-modal'}, props.children);
    };
    return {
        __esModule: true,
        default: MockGenericModal,
    };
});

import ExportOptionsModal, {SectionFlags, Surface} from './export_options_modal';

const wrap = (ui: React.ReactNode) => (
    <IntlProvider
        locale='en'
        messages={{}}
    >
        {ui}
    </IntlProvider>
);

const findCheckboxes = (instance: renderer.ReactTestInstance) =>
    instance.findAllByType('input').filter((n) => n.props.type === 'checkbox');

// Find the rendered <p data-testid="format-hint"> DOM node (not the styled wrapper).
const findFormatHints = (root: renderer.ReactTestInstance) =>
    root.findAllByType('p').filter((n) => n.props['data-testid'] === 'format-hint');

// Recursively collect all string children from a test instance tree.
const collectText = (node: renderer.ReactTestInstance): string =>
    node.children.map((c) => (typeof c === 'string' ? c : collectText(c as renderer.ReactTestInstance))).join('');

type RenderOverrides = Partial<{
    surface: Surface;
    defaults: SectionFlags;
    channelExportAvailable: boolean;
    pdfAvailableServerSide: boolean;
}>;

const render = (overrides: RenderOverrides = {}) => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(wrap(
            <ExportOptionsModal
                surface={overrides.surface ?? 'run'}
                defaults={overrides.defaults ?? {}}
                onConfirm={onConfirm}
                onCancel={onCancel}
                channelExportAvailable={overrides.channelExportAvailable}
                pdfAvailableServerSide={overrides.pdfAvailableServerSide}
            />,
        ));
    });
    return {tree, onConfirm, onCancel};
};

describe('ExportOptionsModal', () => {
    beforeEach(() => {
        capturedHandleConfirm = undefined;
    });

    it('renders 7 toggles for run surface with transcript off by default', () => {
        const {tree} = render({surface: 'run'});
        const checkboxes = findCheckboxes(tree.root);
        expect(checkboxes).toHaveLength(7);
        const transcript = tree.root.findByProps({'data-testid': 'section-toggle-transcript'});
        expect(transcript.findByType('input').props.checked).toBe(false);
        const cover = tree.root.findByProps({'data-testid': 'section-toggle-cover'});
        expect(cover.findByType('input').props.checked).toBe(true);
    });

    it('renders 3 toggles for playbook surface', () => {
        const {tree} = render({surface: 'playbook'});
        const checkboxes = findCheckboxes(tree.root);
        expect(checkboxes).toHaveLength(3);
    });

    it('toggling a section flips its checked state', () => {
        const {tree} = render({surface: 'run'});
        const transcript = tree.root.findByProps({'data-testid': 'section-toggle-transcript'});
        const input = transcript.findByType('input');
        expect(input.props.checked).toBe(false);
        act(() => {
            input.props.onChange();
        });
        const updated = tree.root.findByProps({'data-testid': 'section-toggle-transcript'}).findByType('input');
        expect(updated.props.checked).toBe(true);
    });

    it('hides channel-export hint when unavailable', () => {
        const {tree} = render({surface: 'run', channelExportAvailable: false});
        expect(tree.root.findAllByProps({'data-testid': 'channel-export-hint'})).toHaveLength(0);
    });

    it('shows channel-export hint when available on run surface', () => {
        const {tree} = render({surface: 'run', channelExportAvailable: true});
        expect(tree.root.findAllByProps({'data-testid': 'channel-export-hint'}).length).toBeGreaterThan(0);
    });

    it('does not show channel-export hint on playbook surface', () => {
        const {tree} = render({surface: 'playbook', channelExportAvailable: true});
        expect(tree.root.findAllByProps({'data-testid': 'channel-export-hint'})).toHaveLength(0);
    });

    it('defaults to pdf format with pdf button selected', () => {
        const {tree} = render({surface: 'run'});
        const pdfBtn = tree.root.findByProps({'data-testid': 'format-button-pdf'});
        const mdBtn = tree.root.findByProps({'data-testid': 'format-button-md'});
        const htmlBtn = tree.root.findByProps({'data-testid': 'format-button-html'});
        expect(pdfBtn.props.selected).toBe(true);
        expect(mdBtn.props.selected).toBe(false);
        expect(htmlBtn.props.selected).toBe(false);
    });

    it('clicking Markdown sets format to md', () => {
        const {tree} = render({surface: 'run'});
        const mdBtn = tree.root.findByProps({'data-testid': 'format-button-md'});
        const pdfBtn = tree.root.findByProps({'data-testid': 'format-button-pdf'});

        expect(mdBtn.props.selected).toBe(false);
        act(() => {
            mdBtn.props.onClick();
        });
        expect(mdBtn.props.selected).toBe(true);
        expect(pdfBtn.props.selected).toBe(false);
    });

    it('onConfirm receives md format when Markdown is selected', () => {
        const {tree, onConfirm} = render({surface: 'run'});

        // Select Markdown
        const mdBtn = tree.root.findByProps({'data-testid': 'format-button-md'});
        act(() => {
            mdBtn.props.onClick();
        });

        // Trigger confirm via the captured handleConfirm from the modal mock
        act(() => {
            capturedHandleConfirm?.();
        });

        expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), 'md');
    });

    it('shows browser-print hint when pdfAvailableServerSide is false and format is pdf', () => {
        const {tree} = render({surface: 'run', pdfAvailableServerSide: false});

        // Default format is 'pdf'
        const pdfBtn = tree.root.findByProps({'data-testid': 'format-button-pdf'});
        expect(pdfBtn.props.selected).toBe(true);

        const hints = findFormatHints(tree.root);
        expect(hints).toHaveLength(1);
        expect(collectText(hints[0])).toMatch(/Rendered in your browser/);
    });

    it('shows Gotenberg hint when pdfAvailableServerSide is true and format is pdf', () => {
        const {tree} = render({surface: 'run', pdfAvailableServerSide: true});

        // Default format is 'pdf'
        const pdfBtn = tree.root.findByProps({'data-testid': 'format-button-pdf'});
        expect(pdfBtn.props.selected).toBe(true);

        const hints = findFormatHints(tree.root);
        expect(hints).toHaveLength(1);
        expect(collectText(hints[0])).toMatch(/Gotenberg/);
    });

    it('hides format hint when a non-pdf format is selected', () => {
        const {tree} = render({surface: 'run', pdfAvailableServerSide: false});

        const mdBtn = tree.root.findByProps({'data-testid': 'format-button-md'});
        act(() => {
            mdBtn.props.onClick();
        });

        expect(findFormatHints(tree.root)).toHaveLength(0);
    });

    it('matches snapshot for run surface', () => {
        const {tree} = render({surface: 'run'});
        expect(tree.toJSON()).toMatchSnapshot();
    });

    it('matches snapshot for playbook surface', () => {
        const {tree} = render({surface: 'playbook'});
        expect(tree.toJSON()).toMatchSnapshot();
    });
});
