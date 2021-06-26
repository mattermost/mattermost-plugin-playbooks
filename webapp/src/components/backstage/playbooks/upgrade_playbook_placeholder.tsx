// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import UpgradeBanner from 'src/components/upgrade_banner';
import UpgradePlaybookDashboardSvg from 'src/components/assets/upgrade_playbook_dashboard_svg';
import {SecondaryButton} from 'src/components/assets/buttons';
import UpgradePlaybookErrorSvg from 'src/components/assets/upgrade_playbook_error_svg';
import {AdminNotificationType} from 'src/constants';
import UpgradePlaybookSuccessSvg from 'src/components/assets/upgrade_playbook_success_svg';

const UpgradePlaybookPlaceholder = () => {
    return (
        <UpgradeBanner
            illustration={<UpgradePlaybookDashboardSvg/>}
            successIllustration={<UpgradePlaybookSuccessSvg/>}
            errorIllustration={<UpgradePlaybookErrorSvg/>}
            titleText={'All the statistics you need'}
            helpText={'Upgrade to view trends for total runs, active runs and participants involved in runs of this playbook.'}
            notificationType={AdminNotificationType.MESSAGE_TO_PLAYBOOK_DASHBOARD}
            upgradeWrapperSC={UpgradeWrapper}
            upgradeContentSC={UpgradeContent}
            titleSC={Title}
            helpTextSC={HelpText}
            buttonSC={SecondaryButton}
            footerContainerSC={FooterContainer}
        />
    );
};

const UpgradeWrapper = styled.div`
    display: flex;
    flex-direction: column;
`;

const UpgradeContent = styled.div`
    display: block;
    flex-direction: column;
    align-items: center;
    margin: -175px 0 0 500px;
    max-width: 424px;
`;

const Title = styled.div`
    margin-bottom: 8px;

    font-weight: 600;
    font-size: 20px;
    line-height: 28px;
    color: var(--center-channel-color);
`;

const HelpText = styled.div`
    font-weight: 400;
    font-size: 12px;
    line-height: 16px;
    color: var(--center-channel-color);
`;

const FooterContainer = styled.div`
    margin-top: 18px;

    font-weight: 400;
    font-size: 11px;
    line-height: 16px;
    color: var(--center-channel-color-56);
`;

export default UpgradePlaybookPlaceholder;
