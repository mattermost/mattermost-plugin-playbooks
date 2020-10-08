// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {setRHSOpen, setRHSViewingIncident, setRHSViewingList} from 'src/actions';
import RHSListView from 'src/components/rhs/rhs_list_view';
import {currentRHSState, isIncidentChannel} from 'src/selectors';
import {RHSState} from 'src/types/rhs';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import RHSDetailsView from 'src/components/rhs/rhs_details_view';

// TODO overflow auto is new?
const RHSContainer = styled.div`
    height: calc(100vh - 120px);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: auto;
`;
const RightHandSidebar: FC<null> = () => {
    const dispatch = useDispatch();
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const inIncidentChannel = useSelector<GlobalState, boolean>((state) => isIncidentChannel(state, currentChannelId));
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);
    const [seenChannelId, setSeenChannelId] = useState('');

    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);

    // Update the rhs state when the channel changes
    if (currentChannelId !== seenChannelId) {
        setSeenChannelId(currentChannelId);

        if (inIncidentChannel) {
            dispatch(setRHSViewingIncident());
        } else {
            dispatch(setRHSViewingList());
        }
    }

    if (rhsState === RHSState.ViewingIncident) {
        if (inIncidentChannel) {
            return <RHSDetailsView/>;
        }
        return <RHSWelcomeView/>;
    }

    return <RHSListView/>;
};

export default RightHandSidebar;

// TODO: replace:

<RHSContainer>
    <NoIncidentsContainer>
        <NoContentPlaybookSvgRhs/>
        <NoIncidentsItem>
            <h1>
                {'Take action now with Incident Response.'}
            </h1>
            <p className='mt-3 mb-4 light'>
                {'You don’t have any active incidents at the moment. Start an incident immediately with an existing playbook.'}
            </p>
            <div className='header-button-div mb-4'>
                <PrimaryButton
                    onClick={() => dispatch(startIncident())}
                >
                                    <span>
                                        {'Start Incident'}
                                    </span>
                </PrimaryButton>
            </div>
            <p className='mt-3 mb-4 light'>
                {'You can also create a playbook ahead of time so it’s available when you need it.'}
            </p>
            <TertiaryButton
                onClick={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks')}
            >
                {'Create Playbook'}
            </TertiaryButton>
        </NoIncidentsItem>
    </NoIncidentsContainer>
</RHSContainer>


<RHSContainer>
    <NoIncidentsContainer>
        <NoContentPlaybookSvgRhs/>
        <NoIncidentsItem>
            <h1>
                {'Simplify your processes with Incident Response'}
            </h1>
            <p className='mt-3 mb-8 light'>
                {'Create a playbook to define your incident response workflow. Select a template or create your playbook from scratch.'}
            </p>
            <div className='header-button-div mb-4'>
                <PrimaryButton
                    onClick={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks')}
                >
                    {'Create Playbook'}
                </PrimaryButton>
            </div>
        </NoIncidentsItem>
    </NoIncidentsContainer>
</RHSContainer>

