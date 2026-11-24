// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

// Track the most-recently rendered handleConfirm so tests can trigger it.
let capturedHandleConfirm: (() => void) | undefined;
let capturedConfirmDisabled: boolean | undefined;
let capturedHandleCancel: (() => void) | undefined;

jest.mock('src/components/widgets/generic_modal', () => {
    const ReactImpl = jest.requireActual('react');
    const MockGenericModal = (props: {handleConfirm?: () => void; handleCancel?: () => void; isConfirmDisabled?: boolean; children: React.ReactNode}) => {
        capturedHandleConfirm = props.handleConfirm;
        capturedHandleCancel = props.handleCancel;
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
    useSelector: () => 'Europe/Berlin',
}));

import ExportOptionsModal from './export_options_modal';

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
    channelExportAvailable: boolean;
    retrospectiveEnabled: boolean;
}>;

const render = (overrides: RenderOverrides = {}) => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(wrap(
            <ExportOptionsModal
                onConfirm={onConfirm}
                onCancel={onCancel}
                channelExportAvailable={overrides.channelExportAvailable}
                retrospectiveEnabled={overrides.retrospectiveEnabled}
            />,
        ));
    });
    return {tree, onConfirm, onCancel};
};

describe('ExportOptionsModal', () => {
    beforeEach(() => {
        capturedHandleConfirm = undefined;
    });

    it('renders 6 toggles, all checked by default', () => {
        const {tree} = render();
        const checkboxes = findCheckboxes(tree.root);
        expect(checkboxes).toHaveLength(6);
        expect(checkboxes.every((c) => c.props.checked)).toBe(true);
    });

    it('always includes the executive summary and status updates', () => {
        const {tree} = render();
        for (const key of ['executiveSummary', 'statusUpdates']) {
            const input = tree.root.findByProps({'data-testid': `section-toggle-${key}`}).findByType('input');
            expect(input.props.checked).toBe(true);
            expect(input.props.disabled).toBe(true);
        }
        const timeline = tree.root.findByProps({'data-testid': 'section-toggle-timeline'}).findByType('input');
        expect(timeline.props.disabled).toBeFalsy();
    });

    it('toggling a section flips its checked state', () => {
        const {tree} = render();
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
        const {tree} = render();
        const select = tree.root.findByProps({'data-testid': 'time-zone-field'}).findByProps({'aria-labelledby': 'export-time-zone-label'});
        expect(select.props.value).toEqual({value: '', label: 'Europe/Berlin (your time zone)'});
        expect(select.props.options).toContainEqual({value: 'America/New_York', label: 'America/New York'});
    });

    it('shows a clock next to the picked time zone but not in the list', () => {
        const {tree} = render();
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

    it('onConfirm receives the picked time zone', () => {
        const {tree, onConfirm} = render();
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
        const {tree} = render({channelExportAvailable: false});
        expect(tree.root.findAllByProps({'data-testid': 'channel-export-hint'})).toHaveLength(0);
    });

    it('shows channel-export hint when available', () => {
        const {tree} = render({channelExportAvailable: true});
        expect(tree.root.findAllByProps({'data-testid': 'channel-export-hint'}).length).toBeGreaterThan(0);
    });

    it('defaults to pdf format with the pdf button selected', () => {
        const {tree} = render();
        const pdfBtn = tree.root.findByProps({'data-testid': 'format-button-pdf'});
        const htmlBtn = tree.root.findByProps({'data-testid': 'format-button-html'});
        expect(pdfBtn.props.selected).toBe(true);
        expect(htmlBtn.props.selected).toBe(false);
    });

    it('shows the browser-print hint for pdf and hides it for html', () => {
        const {tree} = render();
        expect(tree.root.findAllByProps({'data-testid': 'format-hint'}).length).toBeGreaterThan(0);

        const htmlBtn = tree.root.findByProps({'data-testid': 'format-button-html'});
        act(() => {
            htmlBtn.props.onClick();
        });
        expect(tree.root.findAllByProps({'data-testid': 'format-hint'})).toHaveLength(0);
    });

    it('onConfirm receives sections, the pdf format, and transcript mode by default', () => {
        const {onConfirm} = render();

        act(() => {
            capturedHandleConfirm?.();
        });

        expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), 'pdf', {transcriptMode: 'threaded', timeZone: ''});
    });

    it('onConfirm receives the html format when HTML is selected', () => {
        const {tree, onConfirm} = render();
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
        const {tree, onConfirm} = render();
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

    it('disables confirm while the export runs', async () => {
        const {onConfirm} = render();
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

    it('matches snapshot', () => {
        const {tree} = render();
        expect(tree.toJSON()).toMatchSnapshot();
    });

    it('cannot be dismissed while the export runs', async () => {
        const {onConfirm, onCancel} = render();
        let finish!: () => void;
        onConfirm.mockReturnValue(new Promise<void>((resolve) => {
            finish = resolve;
        }));

        act(() => {
            capturedHandleConfirm?.();
        });
        act(() => {
            capturedHandleCancel?.();
        });
        expect(onCancel).not.toHaveBeenCalled();

        await act(async () => {
            finish();
        });
        act(() => {
            capturedHandleCancel?.();
        });
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('leaves out a disabled retrospective', () => {
        const {tree, onConfirm} = render({retrospectiveEnabled: false});
        expect(tree.root.findAllByProps({'data-testid': 'section-toggle-retrospective'})).toHaveLength(0);

        act(() => {
            capturedHandleConfirm?.();
        });
        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({retrospective: false}), 'pdf', expect.any(Object));
    });
});
