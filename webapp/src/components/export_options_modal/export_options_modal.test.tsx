// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

// Track the most-recently rendered handleConfirm so tests can trigger it.
let capturedHandleConfirm: (() => void) | undefined;
let capturedConfirmDisabled: boolean | undefined;

jest.mock('src/components/widgets/generic_modal', () => {
    const ReactImpl = jest.requireActual('react');
    const MockGenericModal = (props: {handleConfirm?: () => void; isConfirmDisabled?: boolean; children: React.ReactNode}) => {
        capturedHandleConfirm = props.handleConfirm;
        capturedConfirmDisabled = props.isConfirmDisabled;
        return ReactImpl.createElement('div', {'data-testid': 'mock-generic-modal'}, props.children);
    };
    return {
        __esModule: true,
        default: MockGenericModal,
    };
});

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: () => ({timezone: {useAutomaticTimezone: 'false', manualTimezone: 'Europe/Berlin', automaticTimezone: ''}}),
}));

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

type RenderOverrides = Partial<{
    surface: Surface;
    defaults: SectionFlags;
    channelExportAvailable: boolean;
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
            />,
        ));
    });
    return {tree, onConfirm, onCancel};
};

describe('ExportOptionsModal', () => {
    beforeEach(() => {
        capturedHandleConfirm = undefined;
    });

    it('renders 6 toggles for run surface, all checked by default', () => {
        const {tree} = render({surface: 'run'});
        const checkboxes = findCheckboxes(tree.root);
        expect(checkboxes).toHaveLength(6);
        expect(checkboxes.every((c) => c.props.checked)).toBe(true);
    });

    it('always includes the executive summary and status updates', () => {
        const {tree} = render({surface: 'run', defaults: {executiveSummary: false, statusUpdates: false}});
        for (const key of ['executiveSummary', 'statusUpdates']) {
            const input = tree.root.findByProps({'data-testid': `section-toggle-${key}`}).findByType('input');
            expect(input.props.checked).toBe(true);
            expect(input.props.disabled).toBe(true);
        }
        const timeline = tree.root.findByProps({'data-testid': 'section-toggle-timeline'}).findByType('input');
        expect(timeline.props.disabled).toBeFalsy();
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
        expect(input.props.checked).toBe(true);
        act(() => {
            input.props.onChange();
        });
        const updated = tree.root.findByProps({'data-testid': 'section-toggle-transcript'}).findByType('input');
        expect(updated.props.checked).toBe(false);
    });

    it("offers the user's own time zone first and every IANA time zone", () => {
        const {tree} = render({surface: 'run'});
        const select = tree.root.findByProps({'data-testid': 'time-zone-field'}).findByProps({'aria-labelledby': 'export-time-zone-label'});
        expect(select.props.value).toEqual({value: '', label: 'Europe/Berlin (your time zone)'});
        expect(select.props.options).toContainEqual({value: 'America/New_York', label: 'America/New York'});
    });

    it('shows a clock next to the picked time zone but not in the list', () => {
        const {tree} = render({surface: 'run'});
        const select = tree.root.findByProps({'data-testid': 'time-zone-field'}).findByProps({'aria-labelledby': 'export-time-zone-label'});
        const option = {value: 'Asia/Karachi', label: 'Asia/Karachi'};
        expect(select.props.formatOptionLabel(option, {context: 'menu'})).toBe('Asia/Karachi');

        let value!: renderer.ReactTestRenderer;
        act(() => {
            value = renderer.create(select.props.formatOptionLabel(option, {context: 'value'}));
        });
        expect(value.root.findAllByType('svg')).toHaveLength(1);
        expect(JSON.stringify(value.toJSON())).toContain('Asia/Karachi');
    });

    it('has no time zone field on playbook surface', () => {
        const {tree} = render({surface: 'playbook'});
        expect(tree.root.findAllByProps({'data-testid': 'time-zone-field'})).toHaveLength(0);
    });

    it('onConfirm receives the picked time zone', () => {
        const {tree, onConfirm} = render({surface: 'run'});
        const select = tree.root.findByProps({'data-testid': 'time-zone-field'}).findByProps({'aria-labelledby': 'export-time-zone-label'});
        act(() => {
            select.props.onChange({value: 'Asia/Karachi', label: 'Asia/Karachi'});
        });
        act(() => {
            capturedHandleConfirm?.();
        });

        expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), 'pdf', {transcriptMode: 'threaded', timeZone: 'Asia/Karachi'});
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

    it('defaults to pdf format with the pdf button selected', () => {
        const {tree} = render({surface: 'run'});
        const pdfBtn = tree.root.findByProps({'data-testid': 'format-button-pdf'});
        const htmlBtn = tree.root.findByProps({'data-testid': 'format-button-html'});
        expect(pdfBtn.props.selected).toBe(true);
        expect(htmlBtn.props.selected).toBe(false);
    });

    it('shows the browser-print hint for pdf and hides it for html', () => {
        const {tree} = render({surface: 'run'});
        expect(tree.root.findAllByProps({'data-testid': 'format-hint'}).length).toBeGreaterThan(0);

        const htmlBtn = tree.root.findByProps({'data-testid': 'format-button-html'});
        act(() => {
            htmlBtn.props.onClick();
        });
        expect(tree.root.findAllByProps({'data-testid': 'format-hint'})).toHaveLength(0);
    });

    it('onConfirm receives sections, the pdf format, and transcript mode by default', () => {
        const {onConfirm} = render({surface: 'run'});

        act(() => {
            capturedHandleConfirm?.();
        });

        expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), 'pdf', {transcriptMode: 'threaded', timeZone: ''});
    });

    it('onConfirm receives the html format when HTML is selected', () => {
        const {tree, onConfirm} = render({surface: 'run'});
        const htmlBtn = tree.root.findByProps({'data-testid': 'format-button-html'});
        act(() => {
            htmlBtn.props.onClick();
        });
        act(() => {
            capturedHandleConfirm?.();
        });

        expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), 'html', {transcriptMode: 'threaded', timeZone: ''});
    });

    it('onConfirm receives the md format when Markdown is selected', () => {
        const {tree, onConfirm} = render({surface: 'run'});
        const mdBtn = tree.root.findByProps({'data-testid': 'format-button-md'});
        act(() => {
            mdBtn.props.onClick();
        });
        expect(mdBtn.props.selected).toBe(true);
        expect(tree.root.findAllByProps({'data-testid': 'format-hint'})).toHaveLength(0);
        act(() => {
            capturedHandleConfirm?.();
        });

        expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), 'md', {transcriptMode: 'threaded', timeZone: ''});
    });

    it('onConfirm receives no run options for a playbook', () => {
        const {onConfirm} = render({surface: 'playbook'});
        act(() => {
            capturedHandleConfirm?.();
        });

        expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), 'pdf', {});
    });

    it('disables confirm while the export runs', async () => {
        const {onConfirm} = render({surface: 'run'});
        let finish!: () => void;
        onConfirm.mockReturnValue(new Promise<void>((resolve) => {
            finish = resolve;
        }));

        expect(capturedConfirmDisabled).toBe(false);
        act(() => {
            capturedHandleConfirm?.();
        });
        expect(capturedConfirmDisabled).toBe(true);

        await act(async () => {
            finish();
        });
        expect(capturedConfirmDisabled).toBe(false);
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
