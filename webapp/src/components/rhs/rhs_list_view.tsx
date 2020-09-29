// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import Scrollbars from 'react-custom-scrollbars';
import styled from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import Duration from 'src/components/rhs/duration';
import {
    renderThumbHorizontal,
    renderThumbVertical,
    renderView,
} from 'src/components/rhs/rhs_shared';
import {setRHSState} from 'src/actions';
import {navigateToUrl} from 'src/browser_routing';
import {RHSState} from 'src/types/rhs';
import {Incident} from 'src/types/incident';

const IncidentContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 20px;
    border-bottom: 1px solid var(--center-channel-color-24);
`;

const IncidentTitle = styled.div`
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
    letter-spacing: 0;
    text-align: left;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: 1fr 3fr;
    grid-template-rows: 1fr 1fr 1fr;
    grid-gap: 8px;
    padding: 8px 0 16px 0;
`;

const RowTitle = styled.div`
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
`;

const RowContent = styled.div`
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
`;

const Button = styled.button`
    display: block;
    border: 2px solid var(--button-bg);
    border-radius: 4px;
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    line-height: 9.5px;
    color: var(--button-bg);
    text-align: center;
    padding: 10px 0;
`;

interface Props {
    incidentList: Incident[] | null;
}

const RHSListView = (props: Props) => {
    const dispatch = useDispatch();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const viewIncident = (channelId: string) => {
        dispatch(setRHSState(RHSState.ViewingIncident));
        navigateToUrl(`/${currentTeam.name}/channels/${channelId}`);
    };

    return (
        <Scrollbars
            autoHide={true}
            autoHideTimeout={500}
            autoHideDuration={500}
            renderThumbHorizontal={renderThumbHorizontal}
            renderThumbVertical={renderThumbVertical}
            renderView={renderView}
            style={{position: 'absolute'}}
        >
            {props.incidentList?.map((incident) => {
                return (
                    <IncidentContainer key={incident.id}>
                        <IncidentTitle>{incident.name}</IncidentTitle>
                        <Grid>
                            <RowTitle>{'Stage:'}</RowTitle>
                            <RowContent>{'Stage number ' + incident.active_stage}</RowContent>
                            <RowTitle>{'Duration:'}</RowTitle>
                            <RowContent>
                                <Duration
                                    created_at={incident.create_at}
                                    ended_at={incident.end_at}
                                />
                            </RowContent>
                            <RowTitle>{'Commander:'}</RowTitle>
                            <RowContent>{incident.commander_user_id}</RowContent>
                        </Grid>
                        <Button onClick={() => viewIncident(incident.channel_id)}>
                            {'Go to Incident Channel'}
                        </Button>
                    </IncidentContainer>
                );
            })}
        </Scrollbars>
    );
};

export default RHSListView;
