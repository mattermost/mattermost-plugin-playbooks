// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Line} from 'react-chartjs-2';
import styled from 'styled-components';

const GraphBoxContainer = styled.div`
    padding: 10px;
`;

interface LineGraphProps {
    title: string
    xlabel?: string
    data?: number[]
    labels?: string[]
    className?: string
}

const LineGraph = (props: LineGraphProps) => {
    const style = getComputedStyle(document.body);
    const centerChannelFontColor = style.getPropertyValue('--center-channel-color');
    const buttonBgColor = style.getPropertyValue('--button-bg');
    return (
        <GraphBoxContainer className={props.className}>
            <Line
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
                                fontColor: centerChannelFontColor,
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
                        backgroundColor: buttonBgColor,
                        borderColor: buttonBgColor,
                        pointBackgroundColor: buttonBgColor,
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: buttonBgColor,
                        data: props.data,
                    }],
                }}
            />
        </GraphBoxContainer>
    );
};

export default LineGraph;
