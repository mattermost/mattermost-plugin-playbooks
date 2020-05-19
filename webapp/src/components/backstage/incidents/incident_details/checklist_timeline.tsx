// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import moment, {duration} from 'moment';

import Chart, {ChartOptions} from 'chart.js';

import {Incident} from 'src/types/incident';

import './incident_details.scss';

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
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Incident Duration',
                },
            }],
            yAxes: [{
                type: 'category',
                position: 'left',
                display: true,
                ticks: {
                    reverse: true,
                },
            }],
        },
    };

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

    public initChart = (update?: boolean): void => {
        if (!this.refs.canvas) {
            return;
        }

        const el = ReactDOM.findDOMNode(this.refs.canvas) as HTMLCanvasElement;
        const ctx = el.getContext('2d') as CanvasRenderingContext2D;

        const dataCopy = JSON.parse(JSON.stringify(this.initData()));

        this.chart = new Chart(ctx, {type: 'line', data: dataCopy, options: this.chartOptions || {}});

        if (update) {
            this.chart.update();
        }
    }

    public initData() {
        const chartData = {
            xLabels: [] as any,
            yLabels: [] as any,

            datasets: [{
                fillColor: 'rgba(151,187,205,0.2)',
                borderColor: 'rgba(151,187,205,1)',
                pointBackgroundColor: 'rgba(151,187,205,1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(151,187,205,1)',
                data: [] as any,
            }],
        };

        const checklistItems = this.props.incident.playbook.checklists[0].items;

        console.log('INCIDENT INFO');
        console.log(moment.unix(this.props.incident.created_at).format('DD MMM h:mm:ssA'));
        console.log(checklistItems);

        for (const index in checklistItems) {
            if (!checklistItems[index]) {
                continue;
            }

            const item = checklistItems[index];

            console.log('CHECKLIST ITEM: ' + item.title);
            console.log(moment(item.checked_modified).format('DD MMM h:mm:ssA'));

            let minutes = 0;
            if (item.checked) {
                const checkedTime = moment(item.checked_modified);

                const duration = moment.duration(checkedTime.diff(moment.unix(this.props.incident.created_at)));
                minutes = duration.minutes();
            }

            chartData.xLabels.push(`${minutes}m`);
            chartData.yLabels.push(item.title);
            chartData.datasets[0].data.push({x: minutes, y: item.title});
        }

        console.log('CHART DATA:');
        console.log(chartData);

        return chartData;
    }

    public render(): JSX.Element {
        const data = this.initData();

        let content;
        if (data == null) {
            content = 'Loading...';
        } else if (data.yLabels.length === 0) {
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