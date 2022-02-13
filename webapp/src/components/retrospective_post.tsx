import React from 'react';
import styled from 'styled-components';

import {Post} from 'mattermost-redux/types/posts';

import {CustomPostContainer, CustomPostContent} from 'src/components/custom_post_styles';
import {messageHtmlToComponent, formatText} from 'src/webapp_globals';

import {Metric, MetricType} from 'src/types/playbook';

import {RunMetricData} from 'src/types/playbook_run';

import {ClockOutline, DollarSign, PoundSign} from './backstage/playbook_edit/styles';
import {metricToString} from './backstage/playbook_edit/metrics/shared';

interface Props {
    post: Post;
}

export const RetrospectivePost = (props: Props) => {
    const style = getComputedStyle(document.body);
    const colorName = style.getPropertyValue('--button-bg');

    const markdownOptions = {
        singleline: false,
        mentionHighlight: true,
        atMentions: true,
    };

    const mdText = (text: string) => messageHtmlToComponent(formatText(text, markdownOptions), true, {});

    const metricsConfigs = new Array<Metric>();
    metricsConfigs.push({
        id: '1',
        type: MetricType.Duration,
        title: 'Time to acknowledge',
        description: 'description 1',
        target: 6000000,
    });
    metricsConfigs.push({
        id: '2',
        type: MetricType.Currency,
        title: 'Cost',
        description: 'description 2',
        target: 6000000,
    });
    metricsConfigs.push({
        id: '3',
        type: MetricType.Integer,
        title: 'Number of customers',
        description: 'description 3',
        target: 6000000,
    });
    metricsConfigs.push({
        id: '4',
        type: MetricType.Integer,
        title: 'Time to resolve',
        description: 'description 4',
        target: 6000000,
    });

    let arr: RunMetricData[];
    arr = JSON.parse(props.post.props.metricsData);
    console.log(arr);

    const metricsData = new Array<RunMetricData>();
    metricsData.push({
        metric_config_id: '1',
        value: 55000,
    });
    metricsData.push({
        metric_config_id: '2',
        value: 40,
    });
    metricsData.push({
        metric_config_id: '3',
        value: 23,
    });
    metricsData.push({
        metric_config_id: '4',
        value: 232323,
    });
    return (
        <>
            <TextBody>{mdText(props.post.message)}</TextBody>
            <CustomPostContainerVertical>
                <HeaderGrid>
                    {
                        metricsConfigs?.map((mc, idx) => {
                            let inputIcon = (
                                <DollarSign
                                    sizePx={24}
                                    color={colorName}
                                />);
                            if (mc.type === MetricType.Integer) {
                                inputIcon = (
                                    <PoundSign
                                        sizePx={24}
                                        color={colorName}
                                    />);
                            } else if (mc.type === MetricType.Duration) {
                                inputIcon = (
                                    <ClockOutline
                                        sizePx={24}
                                        color={colorName}
                                    />);
                            }
                            const md = metricsData.find((metric) => metric.metric_config_id === mc.id);
                            if (!md) {
                                return <></>;
                            }
                            return (
                                <MetricInfo key={mc.id}>
                                    <MetricIcon>
                                        {inputIcon}
                                    </MetricIcon>
                                    <ViewContent>
                                        <Title>{mc.title}</Title>
                                        <Value>{metricToString(md.value, mc.type, true)}</Value>
                                    </ViewContent>
                                </MetricInfo>
                            );
                        })
                    }
                </HeaderGrid>
                <Separator/>
                <FullWidthContent>
                    <TextBody>{mdText(props.post.props.retrospectiveText)}</TextBody>
                </FullWidthContent>
            </CustomPostContainerVertical>
        </>
    );
};

const HeaderGrid = styled.div`
    width: 100%;
    display: grid;
	grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    row-gap: 19px;
    place-items: flex-start center;
    justify-items: stretch;
    margin: 8px 0px;
`;

const MetricInfo = styled.div`
    display: flex;
    align-items: center;
`;

const MetricIcon = styled.div`
    display: flex;
    width: 40px;
    height: 40px;
    padding: 10px;
    align-items: center;
    background: rgba(var(--button-bg-rgb), 0.08);
    border-radius: 4px;
    margin: 0px 8px;
`;

const ViewContent = styled.div`
    flex-direction: column;
`;

const Title = styled.div`
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;    
    color: rgba(var(--center-channel-color-rgb), 0.64);
    margin: 2px 0px;
`;

const Value = styled.div`
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
    font-weight: normal;    
    margin: 2px 0px;
`;

const CustomPostContainerVertical = styled(CustomPostContainer)`
    flex-direction: column;
    max-width: 100%;
    padding: 12px 16px;
`;

const FullWidthContent = styled(CustomPostContent)`
    width: 100%;
    padding: 0;
`;

const TextBody = styled.div`
    width: 100%;
    margin-top: 4px;
    margin-bottom: 4px;
`;

const Separator = styled.hr`
    padding-bottom: 0;
    && {
        border: none;
        height: 1px;
        background: rgba(var(--center-channel-color-rgb), 0.61);
    }
`;