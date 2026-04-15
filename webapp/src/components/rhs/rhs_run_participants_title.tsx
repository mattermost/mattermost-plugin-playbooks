// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import LeftChevron from 'src/components/assets/icons/left_chevron';
import {HeaderSubtitle, HeaderVerticalDivider} from 'src/components/backstage/playbook_runs/playbook_run/rhs';

import {RHSTitleButton, RHSTitleContainer, RHSTitleText} from './rhs_title_common';

interface Props {
    onBackClick: () => void
    runName: string
}

const RHSRunParticipantsTitle = (props: Props) => {
    const {formatMessage} = useIntl();

    return (
        <RHSTitleContainer>
            <RHSTitleButton
                onClick={props.onBackClick}
                data-testid='back-button'
            >
                <LeftChevron/>
            </RHSTitleButton>

            <WithTooltip
                title={formatMessage({defaultMessage: 'Manage participants list'})}
                id='view-run-overview'
            >
                <RHSTitleText>
                    {formatMessage({defaultMessage: 'Participants'})}
                </RHSTitleText>
            </WithTooltip>
            <HeaderVerticalDivider/>
            {<HeaderSubtitle data-testid='rhs-subtitle'>{props.runName}</HeaderSubtitle>}
        </RHSTitleContainer>
    );
};

export default RHSRunParticipantsTitle;
