// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useEffect, useRef} from 'react';
import moment from 'moment';
import Chart, {ChartOptions, ChartTooltipItem, ChartTooltipModel, Point} from 'chart.js';

import {GlobalState} from 'mattermost-redux/types/store';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {useSelector} from 'react-redux';

import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import {ChecklistItem, ChecklistItemState, Checklist} from 'src/types/playbook';
import {Incident} from 'src/types/incident';

import EmptyChecklistImage from 'src/components/assets/empty_checklist';

interface Props {
    incident: Incident;
}

interface ChartData{
    yLabels: string[];
    checklistItems: ChecklistItem[];
    datasets: any[];
}

const ChecklistTimeline: FC<Props> = (props: Props) => {
    const theme = useSelector<GlobalState, Record<string, string>>(getTheme);
    const canvas = useRef<HTMLCanvasElement>(null);

    const [chart, setChart] = useState<Chart | null>(null);
    const chartOptions = initChartOptions(theme);
    const chartData = initData(theme, props.incident);

    useEffect(() => {
        if (!canvas || !canvas.current) {
            return;
        }
        setChart(initChart(canvas.current, chartData, chartOptions));
        return () => { //eslint-disable-line consistent-return
            if (chart) {
                chart.destroy();
            }
        };
    }, []);

    let content;

    const numItems = props.incident.checklists?.reduce((accum, current) => accum + current.items?.length, 0);
    if (numItems === 0) {
        content = (<div className='d-flex align-items-center justify-content-center mt-16 mb-14'>
            <div>
                <div>
                    <EmptyChecklistImage theme={theme}/>
                </div>
                <div className='chart-label mt-7'>
                    {'The incident has no checklist items yet'}
                </div>
            </div>
        </div>
        );
    } else {
        // Calculate height based on amount of items using ratio of 40px per item.
        const chartHeight = Math.max(400, chartData.yLabels.length * 40);
        content = (<>
            <div className='chart-title'>
                {'Time occurrence of each checklist item'}
            </div>
            <div style={{height: `${chartHeight}px`}}>
                <canvas
                    ref={canvas}
                />
            </div>
        </>
        );
    }

    return (
        <div className='col-sm-12'>
            {content}
        </div>
    );
};

function initChartOptions(theme: Record<string, string>) {
    Chart.Tooltip.positioners.custom = tooltipPosition;

    const chartOptions: ChartOptions = {
        maintainAspectRatio: false,
        responsive: true,
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
                    fontColor: changeOpacity(theme.centerChannelColor, 0.56),
                },
                gridLines: {

                    // Length and spacing of dashes on grid lines.
                    borderDash: [8, 4],
                    color: changeOpacity(theme.centerChannelColor, 0.16),
                    zeroLineColor: changeOpacity(theme.centerChannelColor, 0.16),
                },
                ticks: {
                    fontColor: changeOpacity(theme.centerChannelColor, 0.72),
                    callback: durationTickLabel,
                },
            }],
            yAxes: [{
                type: 'category',
                position: 'left',
                display: true,
                ticks: {
                    reverse: true,
                    fontColor: changeOpacity(theme.centerChannelColor, 0.72),
                    callback: yAxisLabel,
                },
                gridLines: {
                    display: false,
                },
            }],
        },
        tooltips: {
            custom: tooltipColorBox,
            bodyAlign: 'center',
            position: 'custom',

            // @ts-ignore
            yAlign: 'bottom',
            xAlign: 'center',
            bodyFontFamily: 'Open Sans',
            yPadding: 6,
            callbacks: {
                title: tooltipTitle,
                label: tooltipLabel,
            },
        },
        layout: {
            padding: {
                top: 70,
            },
        },
    };

    return chartOptions;
}

function tooltipPosition(elements: any[], position: Point): Point {
    if (!elements.length) {
        return {x: 0, y: 0};
    }

    return {
        x: position.x,
        y: position.y - 12,
    };
}

function tooltipTitle(tooltipItem: ChartTooltipItem[]): string {
    return tooltipItem[0].yLabel as string || '';
}

function tooltipLabel(tooltipItem: ChartTooltipItem, data: any) {
    if (tooltipItem.index == null) {
        return '';
    }

    const timeUpdated = moment(data.checklistItems[tooltipItem.index].state_modified);
    return timeUpdated.format('MMM DD LT');
}

function tooltipColorBox(tooltip: ChartTooltipModel) {
    if (!tooltip) {
        return;
    }

    // disable displaying the color box
    tooltip.displayColors = false;
}

function durationTickLabel(xValue: number) {
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

function yAxisLabel(value: string) {
    const MAX_CHARS = 25;
    if (value.length > MAX_CHARS) {
        return value.substring(0, MAX_CHARS) + '...';
    }
    return value;
}

function initData(theme: Record<string, string>, incident: Incident) {
    const pointhoverBg = changeOpacity(theme.buttonBg, 0.16);
    const chartData = {
        yLabels: [] as string[],
        checklistItems: [] as ChecklistItem[],

        datasets: [{
            pointBackgroundColor: theme.buttonBg,
            pointHoverBorderColor: pointhoverBg,
            pointRadius: 3,
            pointHoverRadius: 3,
            pointHoverBorderWidth: 12,
            data: [] as any,
        }],
    };

    // Flatten steps into one list
    const checklistItems = incident.checklists?.reduce(
        (prevValue: ChecklistItem[], currValue: Checklist) => ([...prevValue, ...currValue.items]),
        [] as ChecklistItem[],
    );

    // Add points to the graph for checked items
    chartData.checklistItems = checklistItems.filter((item: ChecklistItem) => (
        item.state === ChecklistItemState.Closed && item.state_modified && moment(item.state_modified).isSameOrAfter('2020-01-01')
    )).map((item: ChecklistItem) => {
        if (item.state_modified) {
            const checkedTime = moment(item.state_modified);
            const duration = moment.duration(checkedTime.diff(moment(incident.create_at)));

            chartData.datasets[0].data.push({x: duration.asMilliseconds(), y: item.title});
        }
        return item;
    });

    chartData.yLabels = checklistItems.map((item) => item.title).reverse();

    // Add an initial/last tick to scale
    chartData.yLabels.unshift('');

    return chartData;
}

function initChart(canvas: HTMLCanvasElement, chartData: ChartData, chartOptions: ChartOptions): Chart | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }

    Chart.defaults.customLine = Chart.defaults.line;

    // Custom draw grid line on hover
    Chart.controllers.customLine = Chart.controllers.line.extend({
        draw(ease: any) {
            Chart.controllers.line.prototype.draw.call(this, ease);

            // eslint-disable-next-line no-underscore-dangle
            if (this.chart.tooltip._active && this.chart.tooltip._active.length) {
                // Only draw the custom line when showing the tooltip

                // eslint-disable-next-line no-underscore-dangle
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

    const dataCopy = JSON.parse(JSON.stringify(chartData));
    return new Chart(ctx, {type: 'customLine', data: dataCopy, options: chartOptions});
}

export default ChecklistTimeline;
