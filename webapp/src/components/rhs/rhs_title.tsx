// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {GlobalState} from 'mattermost-redux/types/store';

import LeftChevron from 'src/components/assets/icons/left_chevron';
import {RHSState} from 'src/types/rhs';
import {setRHSState} from 'src/actions';
import {useCurrentIncident} from 'src/hooks';
import {currentRHSState} from 'src/selectors';

const RHSIncidentTitle = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const Button = styled.button`
    border: none;
    background: none;
    padding: 5px 11px 0 0;
`;
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
    const dispatch = useDispatch();
    const [incident] = useCurrentIncident();
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);
    const theme = useSelector<GlobalState, Record<string, string>>(getTheme);

    // jesse's:
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

    // mine:
    const detailsTitle = (
        <RHSIncidentTitle>
            <Button
                onClick={() => dispatch(setRHSState(RHSState.ViewingList))}
            >
                <LeftChevron theme={theme}/>
            </Button>
            {(incident && incident.name) || 'Incidents'}
        </RHSIncidentTitle>
    );

    const listTitle = (
        <RHSIncidentTitle>
            {'Your Ongoing Incidents'}
        </RHSIncidentTitle>
    );

    return (
        rhsState === RHSState.ViewingIncident ? detailsTitle : listTitle
    );
};

export default RHSTitle;
