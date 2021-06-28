// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import UpgradeBanner from 'src/components/upgrade_banner';
import {AdminNotificationType} from 'src/constants';
import UpgradeTimelineBackgroundSvg from '../assets/upgrade_timeline_background_svg';

const Container = styled.div`
    margin: 18px 15px;
`;

const TimelineUpgradePlaceholder = () => {
    return (
        <Container>
            <UpgradeBanner
                background={<UpgradeTimelineBackgroundSvg/>}
                titleText={'Know what happened'}
                helpText={'Make retrospectives easy with a timeline that automatically keeps track of the key events and messages so that teams have it at their fingertips.'}
                notificationType={AdminNotificationType.VIEW_TIMELINE}
                vertical={true}
                verticalAdjustment={380}
            />
        </Container>
    );
};

export default TimelineUpgradePlaceholder;
