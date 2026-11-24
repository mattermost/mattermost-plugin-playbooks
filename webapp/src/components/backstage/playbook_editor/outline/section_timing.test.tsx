// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {IntlProvider} from 'react-intl';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

import {updatePlaybookTiming} from 'src/client';
import {ToastStyle} from 'src/components/backstage/toast';
import {Checklist, emptyChecklistItem} from 'src/types/playbook';
import {PlaybookType, TimingMetric, TimingPointType} from 'src/types/timing_metrics';

import SectionTiming from './section_timing';

jest.mock('src/client', () => ({
    updatePlaybookTiming: jest.fn(),
}));

const mockAddToast = jest.fn();
jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: mockAddToast}),
}));

jest.mock('src/hooks', () => ({
    useNow: () => Date.now(),
    useRunTiming: () => null,
}));

const MINUTE = 60 * 1000;

const checklists: Checklist[] = [{
    title: 'Triage',
    items: [
        {...emptyChecklistItem(), id: 'item1', title: 'Acknowledge'},
        {...emptyChecklistItem(), id: 'item2', title: 'Contain'},
    ],
}];

const acknowledgeMetric: TimingMetric = {
    id: 'metric1',
    name: 'Time to acknowledge',
    industry_name: 'MTTA',
    target_millis: 15 * MINUTE,
    start: {type: TimingPointType.RunStarted},
    end: {type: TimingPointType.TaskFinished, item_id: 'item1'},
};

const renderSection = (props: Partial<React.ComponentProps<typeof SectionTiming>> = {}) => {
    const onSaved = jest.fn();
    render(
        <IntlProvider locale='en'>
            <SectionTiming
                playbookId='pb1'
                checklists={checklists}
                playbookType={PlaybookType.Operational}
                timingMetrics={[]}
                canEdit={true}
                onSaved={onSaved}
                {...props}
            />
        </IntlProvider>,
    );
    return {onSaved};
};

const saveButton = () => screen.getByTestId('timing-metric-save');
const isDisabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;

describe('SectionTiming', () => {
    beforeEach(() => {
        jest.mocked(updatePlaybookTiming).mockReset();
        mockAddToast.mockReset();
    });

    it('explains timing metrics when there are none', () => {
        renderSection();

        expect(screen.getByText(/Measure the time between two points of a run/)).toBeTruthy();
        expect(screen.queryAllByTestId('playbook-timing-metric')).toHaveLength(0);
        expect(screen.getByTestId('timing-metric-add')).toBeTruthy();
    });

    it('describes existing metrics with their points and target', () => {
        renderSection({timingMetrics: [acknowledgeMetric]});

        const metric = screen.getByTestId('playbook-timing-metric');
        expect(metric.textContent).toContain('Time to acknowledge');
        expect(metric.textContent).toContain('MTTA');
        expect(metric.textContent).toContain('Run started → "Acknowledge" finished · target 15 min');
    });

    it('marks metrics pointing at removed tasks', () => {
        renderSection({timingMetrics: [{...acknowledgeMetric, end: {type: TimingPointType.TaskFinished, item_id: 'gone'}}]});

        expect(screen.getByTestId('playbook-timing-metric').textContent).toContain('Run started → Deleted task');
    });

    it('adds a metric and saves it with the playbook type', async () => {
        const saved = [{...acknowledgeMetric, id: 'server-id'}];
        jest.mocked(updatePlaybookTiming).mockResolvedValue({playbook_type: PlaybookType.Operational, timing_metrics: saved} as any);
        const {onSaved} = renderSection();

        fireEvent.click(screen.getByTestId('timing-metric-add'));
        expect(isDisabled(saveButton())).toBe(true);

        fireEvent.change(screen.getByTestId('timing-metric-name'), {target: {value: 'Time to acknowledge'}});
        fireEvent.change(screen.getByTestId('timing-metric-industry-name'), {target: {value: 'MTTA'}});
        expect(isDisabled(saveButton())).toBe(true);

        fireEvent.change(screen.getByTestId('timing-metric-end'), {target: {value: 'task_finished:item1'}});
        fireEvent.change(screen.getByTestId('timing-metric-target'), {target: {value: '15'}});
        expect(isDisabled(saveButton())).toBe(false);

        fireEvent.click(saveButton());

        await waitFor(() => expect(onSaved).toHaveBeenCalledWith(PlaybookType.Operational, saved));
        expect(updatePlaybookTiming).toHaveBeenCalledWith('pb1', PlaybookType.Operational, [{...acknowledgeMetric, id: ''}]);
        expect(screen.queryByTestId('playbook-timing-form')).toBeNull();
    });

    it('does not allow a metric to start and end at the same point', () => {
        renderSection();

        fireEvent.click(screen.getByTestId('timing-metric-add'));
        fireEvent.change(screen.getByTestId('timing-metric-name'), {target: {value: 'Zero'}});
        fireEvent.change(screen.getByTestId('timing-metric-start'), {target: {value: 'task_finished:item1'}});
        fireEvent.change(screen.getByTestId('timing-metric-end'), {target: {value: 'task_finished:item1'}});

        expect(isDisabled(saveButton())).toBe(true);
    });

    it('shows a failure toast and keeps the form open when saving fails', async () => {
        jest.mocked(updatePlaybookTiming).mockRejectedValue(new Error('nope'));
        const {onSaved} = renderSection();

        fireEvent.click(screen.getByTestId('timing-metric-add'));
        fireEvent.change(screen.getByTestId('timing-metric-name'), {target: {value: 'Time to acknowledge'}});
        fireEvent.change(screen.getByTestId('timing-metric-end'), {target: {value: 'task_finished:item1'}});
        fireEvent.click(saveButton());

        await waitFor(() => expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({toastStyle: ToastStyle.Failure})));
        expect(onSaved).not.toHaveBeenCalled();
        expect(screen.getByTestId('playbook-timing-form')).toBeTruthy();
    });

    it('saves the playbook type when it changes', async () => {
        jest.mocked(updatePlaybookTiming).mockResolvedValue({playbook_type: PlaybookType.Exercise, timing_metrics: [acknowledgeMetric]} as any);
        const {onSaved} = renderSection({timingMetrics: [acknowledgeMetric]});

        fireEvent.change(screen.getByTestId('playbook-type-select'), {target: {value: PlaybookType.Exercise}});

        await waitFor(() => expect(onSaved).toHaveBeenCalledWith(PlaybookType.Exercise, [acknowledgeMetric]));
        expect(updatePlaybookTiming).toHaveBeenCalledWith('pb1', PlaybookType.Exercise, [acknowledgeMetric]);
    });

    it('removes a metric', async () => {
        jest.mocked(updatePlaybookTiming).mockResolvedValue({playbook_type: PlaybookType.Operational, timing_metrics: []} as any);
        const {onSaved} = renderSection({timingMetrics: [acknowledgeMetric]});

        fireEvent.click(screen.getByText('Remove'));

        await waitFor(() => expect(onSaved).toHaveBeenCalledWith(PlaybookType.Operational, []));
        expect(updatePlaybookTiming).toHaveBeenCalledWith('pb1', PlaybookType.Operational, []);
    });

    it('saves an edited metric in place after another metric was removed', async () => {
        jest.mocked(updatePlaybookTiming).mockImplementation(async (_id, playbookType, timingMetrics) => ({playbook_type: playbookType, timing_metrics: timingMetrics}) as any);
        const metrics = ['A', 'B', 'C'].map((name) => ({...acknowledgeMetric, id: `metric-${name}`, name}));
        const Stateful = () => {
            const [timingMetrics, setTimingMetrics] = useState(metrics);
            return (
                <SectionTiming
                    playbookId='pb1'
                    checklists={checklists}
                    playbookType={PlaybookType.Operational}
                    timingMetrics={timingMetrics}
                    canEdit={true}
                    onSaved={(_, next) => setTimingMetrics(next)}
                />
            );
        };
        render(
            <IntlProvider locale='en'>
                <Stateful/>
            </IntlProvider>,
        );

        fireEvent.click(screen.getAllByText('Edit')[1]);
        fireEvent.click(screen.getAllByText('Remove')[0]);
        await waitFor(() => expect(screen.getAllByTestId('playbook-timing-metric')).toHaveLength(2));
        fireEvent.change(screen.getByTestId('timing-metric-name'), {target: {value: 'B edited'}});
        fireEvent.click(saveButton());

        await waitFor(() => expect(updatePlaybookTiming).toHaveBeenCalledTimes(2));
        expect(jest.mocked(updatePlaybookTiming).mock.calls[1][2].map((metric) => metric.name)).toEqual(['B edited', 'C']);
    });

    it('drops the edit when the metric being edited is removed', async () => {
        jest.mocked(updatePlaybookTiming).mockResolvedValue({playbook_type: PlaybookType.Operational, timing_metrics: []} as any);
        renderSection({timingMetrics: [acknowledgeMetric]});

        fireEvent.click(screen.getByText('Edit'));
        fireEvent.click(screen.getByText('Remove'));

        await waitFor(() => expect(screen.queryByTestId('playbook-timing-form')).toBeNull());
    });

    it('does not let another draft start while a removal is saving', async () => {
        let finishRemoval: (value: any) => void = () => undefined;
        jest.mocked(updatePlaybookTiming).mockReturnValue(new Promise((resolve) => {
            finishRemoval = resolve;
        }));
        const metrics = ['A', 'B'].map((name) => ({...acknowledgeMetric, id: `metric-${name}`, name}));
        renderSection({timingMetrics: metrics});

        fireEvent.click(screen.getAllByText('Edit')[0]);
        fireEvent.click(screen.getAllByText('Remove')[0]);

        expect(screen.getAllByText('Edit').every((button) => isDisabled(button.closest('button') as HTMLElement))).toBe(true);

        await act(async () => {
            finishRemoval({playbook_type: PlaybookType.Operational, timing_metrics: [metrics[1]]});
        });
        expect(screen.queryByTestId('playbook-timing-form')).toBeNull();
    });

    it('is read-only for users who cannot edit the playbook', () => {
        renderSection({timingMetrics: [acknowledgeMetric], canEdit: false});

        expect(isDisabled(screen.getByTestId('playbook-type-select'))).toBe(true);
        expect(screen.queryByTestId('timing-metric-add')).toBeNull();
        expect(screen.queryByText('Edit')).toBeNull();
        expect(screen.queryByText('Remove')).toBeNull();
    });
});
