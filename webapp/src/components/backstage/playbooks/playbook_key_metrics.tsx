// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {PlaybookWithChecklist} from 'src/types/playbook';
import {PlaybookStats} from 'src/types/stats';
import {useAllowPlaybookAndRunMetrics} from 'src/hooks';
import UpgradeKeyMetricsPlaceholder from 'src/components/backstage/playbooks/upgrade_key_metrics_placeholder';

interface Props {
    playbook: PlaybookWithChecklist;
    stats: PlaybookStats;
}

const PlaybookKeyMetrics = ({playbook, stats}: Props) => {
    const allowStatsView = useAllowPlaybookAndRunMetrics();

    if (!allowStatsView) {
        return (
            <OuterContainer>
                <InnerContainer>
                    <PlaceholderRow>
                        <UpgradeKeyMetricsPlaceholder/>
                    </PlaceholderRow>
                </InnerContainer>
            </OuterContainer>
        );
    }

    return (
        <OuterContainer>
            <InnerContainer>
                {'Key metrics tab content.'}
            </InnerContainer>
        </OuterContainer>
    );
};

const PlaceholderRow = styled.div`
    height: 260px;
    margin: 32px 0;
`;

const OuterContainer = styled.div`
    height: 100%;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
`;

const InnerContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 20px;
    max-width: 1120px;
    margin: 0 auto;
    font-style: normal;
    font-weight: 600;

    > div + div {
        margin-top: 16px;
    }
`;

export default PlaybookKeyMetrics;
