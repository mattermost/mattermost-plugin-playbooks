// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import styled from 'styled-components';

import {useCurrentIncident} from 'src/hooks';

import StatusBadge from '../backstage/incidents/status_badge';

const RHSTitleContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    overflow: hidden;
`;

const RHSTitleText = styled.div`
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
`;

const RHSTitle: FC = () => {
    const [incident] = useCurrentIncident();

    return (
        <RHSTitleContainer>
            <RHSTitleText>{incident?.name || 'Incidents'}</RHSTitleText>
            {incident && (
                <StatusBadge
                    isActive={incident?.is_active}
                    compact={true}
                />
            )}
        </RHSTitleContainer>
    );
};

export default RHSTitle;
