// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Bar} from 'react-chartjs-2';
import styled from 'styled-components';

const GraphBoxContainer = styled.div`
    padding: 10px;
`;

interface BarGraphProps {
    title: string
    xlabel?: string
    data?: number[]
    labels?: string[]
    className?: string
    color?: string
}

const BarGraph = (props: BarGraphProps) => {
    const style = getComputedStyle(document.body);
    const centerChannelFontColor = style.getPropertyValue('--center-channel-color');
    const colorName = props.color ? props.color : '--button-bg';
    const color = style.getPropertyValue(colorName);
    return (
        <GraphBoxContainer className={props.className}>
            <Bar
                legend={{display: false}}
                options={{
                    title: {
                        display: true,
                        text: props.title,
                        fontColor: centerChannelFontColor,
                    },
                    scales: {
                        yAxes: [{
                            ticks: {
                                beginAtZero: true,
                                fontColor: centerChannelFontColor,
                            },
                        }],
                        xAxes: [{
                            scaleLabel: {
                                display: Boolean(props.xlabel),
                                labelString: props.xlabel,
                                fontColor: centerChannelFontColor,
                            },
                            ticks: {
                                callback: (val: any, index: number) => {
                                    return (index % 2) === 0 ? val : '';
                                },
                                fontColor: centerChannelFontColor,
                                maxRotation: 0,
                            },
                        }],
                    },
                    maintainAspectRatio: false,
                    responsive: true,
                }}
                data={{
                    labels: props.labels,
                    datasets: [{
                        fill: false,
                        tension: 0,
                        backgroundColor: color,
                        borderColor: color,
                        pointBackgroundColor: color,
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: color,
                        data: props.data,
                    }],
                }}
            />
        </GraphBoxContainer>
    );
};

export default BarGraph;
