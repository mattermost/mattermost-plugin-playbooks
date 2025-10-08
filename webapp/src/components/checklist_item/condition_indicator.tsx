// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {SourceBranchIcon} from '@mattermost/compass-icons/components';

import Tooltip from 'src/components/widgets/tooltip';
import {ChecklistItem} from 'src/types/playbook';

interface ConditionIndicatorProps {
    checklistItem: ChecklistItem;
}

const ConditionIndicator = ({checklistItem}: ConditionIndicatorProps) => {
    const {formatMessage} = useIntl();

    if (!checklistItem.condition_id) {
        return null;
    }

    const useErrorColor = checklistItem.condition_action === 'shown_because_modified';
    const tooltipId = `condition-indicator-${checklistItem.id || 'new'}`;
    const iconColor = useErrorColor ? 'var(--error-text)' : 'rgba(var(--center-channel-color-rgb), 0.56)';

    const tooltipContent = formatMessage(
        {defaultMessage: 'conditionally rendered: {reason}'},
        {reason: checklistItem.condition_reason},
    );

    return (
        <Tooltip
            id={tooltipId}
            content={tooltipContent}
        >
            <IconWrapper>
                <SourceBranchIcon
                    size={14}
                    color={iconColor}
                />
            </IconWrapper>
        </Tooltip>
    );
};

const IconWrapper = styled.span`
    margin-right: 6px;
    transform: rotate(90deg);
`;

export default ConditionIndicator;
