// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import moment from 'moment';

import Chart, {ChartOptions, ChartTooltipItem} from 'chart.js';

import {Incident} from 'src/types/incident';

import './incident_details.scss';
import {ChecklistItem} from 'src/types/playbook';

interface Props {
    theme: Record<string, string>;
    title: React.ReactNode;
    width: number;
    height: number;
    data?: any;
    incident: Incident;
}

export default class ChecklistTimeline extends React.PureComponent<Props> {
    public chart: Chart | null = null;
    public chartOptions: ChartOptions = {
        showLines: false,
        legend: {
            display: false,
        },
        scales: {
            xAxes: [{
                type: 'category',
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Duration',
                },
                gridLines: {
                    borderDash: [8, 4],
                },
            }],
            yAxes: [{
                type: 'category',
                position: 'left',
                display: true,
                ticks: {
                    reverse: true,
                },
                gridLines: {
                    display: false,
                },
            }],
        },
        tooltips: {
            custom: (tooltip) => {
                if (!tooltip) {
                    return;
                }

                // disable displaying the color box
                tooltip.displayColors = false;
            },
            callbacks: {
                title: () => '',
                label: this.tooltipLabel,
            },
        },
    };

    public tooltipLabel(tooltipItem: ChartTooltipItem, data: any) {
        const timeUpdated = moment(data.checklistItems[tooltipItem.index].checked_modified);
        return timeUpdated.format('MMM DD LT');
    }

    public componentDidMount(): void {
        this.initChart();
    }

    /*
    public componentDidUpdate(prevProps: Props): void {
        const currentData = this.props.data && this.props.data.labels.length > 0;

        if (!currentData && this.chart) {
            // Clean up the rendered chart before we render and destroy its context
            this.chart.destroy();
            this.chart = null;
        }

        if (Utils.areObjectsEqual(prevProps.data, this.props.data)) {
            return;
        }

        const hasData = this.props.data && this.props.data.labels.length > 0;
        const hasChart = Boolean(this.chart);

        if (hasData) {
            // Update the rendered chart or initialize it as necessary
            this.initChart(hasChart);
        }
    }*/

    public componentWillUnmount(): void {
        if (this.chart) {
            this.chart.destroy();
        }
    }

    public compare(incidentA: {item: ChecklistItem; duration: moment.Duration}, incidentB: {item: ChecklistItem; duration: moment.Duration}) {
        const msA = incidentA.duration?.asMilliseconds() | 0;
        const msB = incidentB.duration?.asMilliseconds() | 0;

        if (msA > msB) {
            return 1;
        }
        if (msB > msA) {
            return -1;
        }

        return 0;
    }

    public initData() {
        const chartData = {
            xLabels: [] as any,
            yLabels: [] as any,
            checklistItems: [] as ChecklistItem[],

            datasets: [{
                borderColor: 'rgba(151,187,205,1)',
                pointBackgroundColor: this.props.theme.buttonBg,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: 'var(--sidebar-bg-16)',
                pointHoverBorderColor: 'rgba(151,187,205,1)',
                pointRadius: 5,
                pointHoverRadius: 15,
                data: [] as any,
            }],
        };

        const checklistItems = this.props.incident.playbook.checklists[0].items;

        const durations = [];
        for (const index in checklistItems) {
            if (!checklistItems[index]) {
                continue;
            }

            const item = checklistItems[index];

            let duration = null;
            if (item.checked) {
                const checkedTime = moment(item.checked_modified);
                duration = moment.duration(checkedTime.diff(moment.unix(this.props.incident.created_at)));
            }

            chartData.yLabels.push(item.title);
            durations.push({item, duration});
        }

        durations.sort(this.compare);

        for (const d in durations) {
            if (!durations[d]) {
                continue;
            }
            const item = durations[d];

            if (item.duration) {
                chartData.datasets[0].data.push({x: item.duration.humanize(), y: item.item.title});
                chartData.checklistItems.push(item.item);

                if (!chartData.xLabels.includes(item.duration?.humanize())) {
                    chartData.xLabels.push(item.duration?.humanize());
                }
            }
        }

        chartData.yLabels = chartData.yLabels.reverse();
        chartData.yLabels.unshift('');

        // Add an initial/last tick to scale
        chartData.xLabels.unshift('');
        chartData.xLabels.push('');

        return chartData;
    }

    public initChart = (update?: boolean): void => {
        if (!this.refs.canvas) {
            return;
        }

        const el = ReactDOM.findDOMNode(this.refs.canvas) as HTMLCanvasElement;
        const ctx = el.getContext('2d') as CanvasRenderingContext2D;

        const chartData = this.initData();

        const dataCopy = JSON.parse(JSON.stringify(chartData));

        this.chart = new Chart(ctx, {type: 'line', data: dataCopy, options: this.chartOptions || {}});

        if (update) {
            this.chart.update();
        }
    }

    public render(): JSX.Element {
        const chartData = this.initData();

        let content;
        if (chartData == null) {
            content = 'Loading...';
        } else if (chartData.yLabels.length === 0) {
            content = (
                'Not enough data for a meaningful representation.'
            );
        } else {
            content = (
                <canvas
                    ref='canvas'

                    width={this.props.width}
                    height={this.props.height}
                />
            );
        }

        return (
            <div className='col-sm-12'>
                <div className='total-count by-day'>
                    <div className='title'>
                        {'Time occurance of each Checklist item'}
                    </div>
                    <div className='content'>
                        {content}
                    </div>
                </div>
            </div>
        );
    }
}