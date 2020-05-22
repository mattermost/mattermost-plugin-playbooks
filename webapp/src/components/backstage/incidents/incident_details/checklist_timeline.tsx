// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import moment from 'moment';

import Chart, {ChartOptions, ChartTooltipItem, ChartTooltipModel} from 'chart.js';

import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import {ChecklistItem} from 'src/types/playbook';
import {Incident} from 'src/types/incident';

import EmptyChecklitImage from 'src/components/assets/empty_checklist';

import './incident_details.scss';

interface Props {
    theme: Record<string, string>;
    width: number;
    height: number;
    incident: Incident;
}

interface ChartData{
    yLabels: string[];
    checklistItems: ChecklistItem[];
    datasets: any[];
}

export default class ChecklistTimeline extends React.PureComponent<Props> {
    public chart: Chart | null = null;
    public chartOptions: ChartOptions;
    public chartData: ChartData;

    constructor(props: Props) {
        super(props);

        this.chartOptions = this.initChartOptions();
        this.chartData = this.initData();
    }

    public componentDidMount(): void {
        this.initChart();
    }

    public componentWillUnmount(): void {
        if (this.chart) {
            this.chart.destroy();
        }
    }

    public initChartOptions() {
        const chartOptions: ChartOptions = {
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
                        fontColor: changeOpacity(this.props.theme.centerChannelColor, 0.56),
                    },
                    gridLines: {
                        borderDash: [8, 4],
                        color: changeOpacity(this.props.theme.centerChannelColor, 0.16),
                        zeroLineColor: changeOpacity(this.props.theme.centerChannelColor, 0.16),
                    },
                    ticks: {
                        fontColor: changeOpacity(this.props.theme.centerChannelColor, 0.72),
                        callback: this.durationTickLabel,
                    },
                }],
                yAxes: [{
                    type: 'category',
                    position: 'left',
                    display: true,
                    ticks: {
                        reverse: true,
                        fontColor: changeOpacity(this.props.theme.centerChannelColor, 0.72),
                    },
                    gridLines: {
                        display: false,
                    },
                }],
            },
            tooltips: {
                custom: this.tooltipColorBox,
                bodyAlign: 'center',

                // @ts-ignore
                yAlign: 'bottom',
                callbacks: {
                    title: () => '', // Empty tooltip title
                    label: this.tooltipLabel,
                },
            },
        };

        return chartOptions;
    }

    public tooltipLabel(tooltipItem: ChartTooltipItem, data: any) {
        if (tooltipItem.index == null) {
            return '';
        }

        const timeUpdated = moment(data.checklistItems[tooltipItem.index].checked_modified);
        return timeUpdated.format('MMM DD LT');
    }

    public tooltipColorBox(tooltip: ChartTooltipModel) {
        if (!tooltip) {
            return;
        }

        // disable displaying the color box
        tooltip.displayColors = false;
    }

    public durationTickLabel(xValue: number) {
        const duration = moment.duration(xValue);

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
    }

    public initData() {
        const chartData = {
            yLabels: [] as string[],
            checklistItems: [] as ChecklistItem[],

            datasets: [{
                pointBackgroundColor: this.props.theme.buttonBg,
                pointBorderColor: this.props.theme.buttonBg,
                pointHoverBackgroundColor: this.props.theme.buttonBg,
                pointHoverBorderColor: this.props.theme.buttonBg,
                pointRadius: 3,
                pointHoverRadius: 10,
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

        // Add an initial/last tick to scale
        chartData.yLabels.unshift('');
        chartData.yLabels.push('');

        return chartData;
    }

    public initChart = (): void => {
        if (!this.refs.canvas) {
            return;
        }

        const el = ReactDOM.findDOMNode(this.refs.canvas) as HTMLCanvasElement;
        const ctx = el.getContext('2d') as CanvasRenderingContext2D;

        Chart.defaults.customLine = Chart.defaults.line;

        // Custom draw grid line on hover
        Chart.controllers.customLine = Chart.controllers.line.extend({
            draw(ease: any) {
                Chart.controllers.line.prototype.draw.call(this, ease);

                // Only draw the custom line when showing the tooltip
                if (this.chart.tooltip._active && this.chart.tooltip._active.length) {
                    const activePoint = this.chart.tooltip._active[0];

                    const y = activePoint.tooltipPosition().y;
                    const x = activePoint.tooltipPosition().x;

                    // draw line
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(this.chart.chartArea.left, y);
                    ctx.lineWidth = 0.5;

                    ctx.lineTo(x, y);
                    ctx.lineTo(x, this.chart.chartArea.bottom);

                    ctx.stroke();
                    ctx.restore();
                }
            },
        });

        const dataCopy = JSON.parse(JSON.stringify(this.chartData));
        this.chart = new Chart(ctx, {type: 'customLine', data: dataCopy, options: this.chartOptions});
    };

    public render(): JSX.Element {
        let content;
        if (this.chartData.yLabels.length === 2) {
            // No data if it only has the two trailing empty labels
            content = (<div className='content'>
                <div>
                    <EmptyChecklitImage theme={this.props.theme}/>
                </div>
                <div className='chart-label'>
                    {'The incident has no checklist items yet'}
                </div>
            </div>
            );
        } else {
            content = (<>
                <div className='chart-title'>
                    {'Time occurance of each Checklist item'}
                </div>
                <canvas
                    ref='canvas'
                    width={this.props.width}
                    height={this.props.height}
                />
            </>
            );
        }

        return (
            <div className='col-sm-12'>
                {content}
            </div>
        );
    }
}
