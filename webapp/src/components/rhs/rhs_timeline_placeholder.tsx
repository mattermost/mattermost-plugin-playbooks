// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import UpgradeTimelineSvg from 'src/components/assets/upgrade_timeline_svg';
import UpgradeBanner from 'src/components/upgrade_banner';
import UpgradeTimelineSuccessSvg from 'src/components/assets/upgrade_timeline_success_svg';
import UpgradeTimelineErrorSvg from 'src/components/assets/upgrade_timeline_error_svg';
import {PrimaryButton} from 'src/components/assets/buttons';
import {AdminNotificationType} from 'src/constants';

const TimelineUpgradePlaceholder = () => {
    return (
        <UpgradeBanner
            illustration={<UpgradeTimelineSvg/>}
            successIllustration={<UpgradeTimelineSuccessSvg/>}
            errorIllustration={<UpgradeTimelineErrorSvg/>}
            titleText={'Know what happened'}
            helpText={'Make retrospectives easy with a timeline that automatically keeps track of the key events and messages so that teams have it at their fingertips.'}
            notificationType={AdminNotificationType.VIEW_TIMELINE}
            upgradeWrapperSC={UpgradeWrapper}
            upgradeContentSC={UpgradeContent}
            titleSC={Title}
            helpTextSC={HelpText}
            buttonSC={PrimaryButton}
            footerContainerSC={FooterContainer}
        />
    );
};

const UpgradeWrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
`;
const UpgradeContent = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 30px;
    margin-top: -330px;
`;

const CenteredRow = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
`;

const Title = styled(CenteredRow)`
    text-align: center;
    margin-bottom: 8px;

    font-weight: 600;
    font-size: 24px;
    color: var(--center-channel-color);
`;

const HelpText = styled(CenteredRow)`
    flex-direction: column;
    text-align: center;
    font-weight: 400;
    font-size: 12px;
    color: var(--center-channel-color);
`;

const FooterContainer = styled.div`
    font-size: 11px;
    line-height: 16px;

    display: flex;
    align-items: center;
    text-align: center;

    color: rgba(var(--center-channel-color, 0.56));

    margin-top: 18px;
`;

export default TimelineUpgradePlaceholder;
