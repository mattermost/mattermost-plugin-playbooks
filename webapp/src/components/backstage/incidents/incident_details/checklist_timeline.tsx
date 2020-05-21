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
                type: 'linear',
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Duration',
                },
                gridLines: {
                    borderDash: [8, 4],
                },
                ticks: {
                    callback: (value) => {
                        const duration = moment.duration(value);

                        if (duration.days()) {
                            return `${duration.days()} days ${duration.hours()} h`;
                        }

                        if (duration.hours()) {
                            return `${duration.hours()} h ${duration.minutes()} m`;
                        }

                        if (duration.minutes()) {
                            return `${duration.minutes()} m`;
                        }

                        return `${duration.seconds()} s`;
                    },
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

    public initData() {
        const chartData = {
            yLabels: [] as any,
            checklistItems: [] as ChecklistItem[],

            datasets: [{
                borderColor: 'rgba(151,187,205,1)',
                pointBackgroundColor: this.props.theme.buttonBg,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: 'var(--sidebar-bg-color-16)',
                pointHoverBorderColor: 'rgba(151,187,205,1)',
                pointRadius: 5,
                pointHoverRadius: 15,
                data: [] as any,
            }],
        };

        const checklistItems = this.props.incident.playbook.checklists[0].items;

        for (const index in checklistItems) {
            if (!checklistItems[index]) {
                continue;
            }

            const item = checklistItems[index];

            if (item.checked) {
                // Add point to the graph
                const checkedTime = moment(item.checked_modified);
                const duration = moment.duration(checkedTime.diff(moment.unix(this.props.incident.created_at)));

                chartData.datasets[0].data.push({x: duration.asMilliseconds(), y: item.title});
                chartData.checklistItems.push(item);
            }

            chartData.yLabels.push(item.title);
        }

        chartData.yLabels = chartData.yLabels.reverse();

        // Add an initial/last tick to scales
        chartData.yLabels.unshift('');
        chartData.yLabels.push('');

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
        } else if (chartData.yLabels.length === 2) {
            // If it only has the trailing empty labels
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