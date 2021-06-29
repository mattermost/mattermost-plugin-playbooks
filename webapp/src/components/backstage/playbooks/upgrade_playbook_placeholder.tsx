// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import UpgradeBanner from 'src/components/upgrade_banner';
import {AdminNotificationType} from 'src/constants';
import UpgradePlaybookBackgroundSvg from 'src/components/assets/upgrade_playbook_background_svg';

const UpgradePlaybookPlaceholder = () => {
    return (
        <UpgradeBanner
            background={<UpgradePlaybookBackgroundSvg/>}
            titleText={'All the statistics you need'}
            helpText={'Upgrade to view trends for total runs, active runs and participants involved in runs of this playbook.'}
            notificationType={AdminNotificationType.MESSAGE_TO_PLAYBOOK_DASHBOARD}
            verticalAdjustment={200}
            secondaryButton={true}
        />
    );
};

export default UpgradePlaybookPlaceholder;
