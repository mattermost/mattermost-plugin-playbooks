// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {GlobalState} from 'mattermost-redux/types/store';

import LeftChevron from 'src/components/assets/icons/left_chevron';
import {RHSState} from 'src/types/rhs';
import {setRHSViewingList} from 'src/actions';
import {useCurrentIncident} from 'src/hooks';
import {currentRHSState} from 'src/selectors';
import StatusBadge from 'src/components/backstage/incidents/status_badge';

const RHSTitleContainer = styled.div`
    display: flex;
    justify-content: space-between;
    overflow: hidden;
`;

const RHSTitleText = styled.div`
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
`;

const Button = styled.button`
    display: flex;
    border: none;
    background: none;
    padding: 0px 11px 0 0;
    align-items: center;
`;

const RHSTitle: FC = () => {
    const dispatch = useDispatch();
    const [incident] = useCurrentIncident();
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);
    const theme = useSelector<GlobalState, Record<string, string>>(getTheme);

    if (rhsState === RHSState.ViewingIncident) {
        return (
            <RHSTitleContainer>
                <Button
                    onClick={() => dispatch(setRHSViewingList())}
                    data-testid='back-button'
                >
                    <LeftChevron theme={theme}/>
                </Button><RHSTitleText data-testid='rhs-title'>{incident?.name || 'Incidents'}</RHSTitleText>
                {incident && (
                    <StatusBadge
                        isActive={incident?.is_active}
                        compact={true}
                    />
                )}
            </RHSTitleContainer>
        );
    }

    return (
        <RHSTitleText>
            {'Your Ongoing Incidents'}
        </RHSTitleText>
    );
};

export default RHSTitle;
