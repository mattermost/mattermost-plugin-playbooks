// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import Scrollbars from 'react-custom-scrollbars';
import {useSelector} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {isCurrentChannelArchived} from 'mattermost-redux/selectors/entities/channels';

import {fetchUsersInChannel, setCommander} from 'src/client';
import {Incident, incidentCurrentStatus} from 'src/types/incident';
import ProfileSelector from 'src/components/profile/profile_selector';
import Duration from '../duration';
import './incident_details.scss';
import {
    renderThumbHorizontal,
    renderThumbVertical,
    renderView,
} from 'src/components/rhs/rhs_shared';
import LatestUpdate from 'src/components/rhs/latest_update';
import StatusBadge from '../backstage/incidents/status_badge';

interface Props {
    incident: Incident;
}

const RHSIncidentSummary: FC<Props> = (props: Props) => {
    const isChannelArchived = useSelector<GlobalState, boolean>(isCurrentChannelArchived);

    const fetchUsers = async () => {
        return fetchUsersInChannel(props.incident.channel_id);
    };

    const onSelectedProfileChange = async (userId?: string) => {
        if (!userId) {
            return;
        }
        const response = await setCommander(props.incident.id, userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
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
            <div className='IncidentDetails'>
                <div className='side-by-side'>
                    <div className='inner-container first-container'>
                        <div className='first-title'>{'Commander'}</div>
                        <ProfileSelector
                            selectedUserId={props.incident.commander_user_id}
                            placeholder={'Assign Commander'}
                            placeholderButtonClass={'NoAssignee-button'}
                            profileButtonClass={'Assigned-button'}
                            enableEdit={true}
                            getUsers={fetchUsers}
                            onSelectedChange={onSelectedProfileChange}
                            selfIsFirstOption={true}
                            disabled={isChannelArchived}
                        />
                    </div>
                    <div className='first-title'>
                        {'Duration'}
                        <Duration
                            from={props.incident.create_at}
                            to={props.incident.end_at}
                        />
                    </div>
                </div>
                <div className='side-by-side'>
                    <div className='inner-container first-container'>
                        <div className='first-title'>{'Status'}</div>
                        <div>
                            <StatusBadge status={incidentCurrentStatus(props.incident)}/>
                        </div>
                    </div>
                    <div className='inner-container'>
                        <div className='first-title'>{'Reporter'}</div>
                        <ProfileSelector
                            selectedUserId={props.incident.reporter_user_id}
                            placeholder={'Reporter Not Available'}
                            placeholderButtonClass={'NoAssignee-button'}
                            profileButtonClass={'Assigned-button'}
                            enableEdit={false}
                            getUsers={fetchUsers}
                            selfIsFirstOption={true}
                        />
                    </div>
                </div>
                <div id={'incidentRHSUpdates'}>
                    <div className='title'>
                        {'Recent Update:'}
                    </div>
                    <LatestUpdate statusPosts={props.incident.status_posts}/>
                </div>
            </div>
        </Scrollbars>
    );
};

export default RHSIncidentSummary;
