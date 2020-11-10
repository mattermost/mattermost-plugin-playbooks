// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import Scrollbars from 'react-custom-scrollbars';

import {fetchUsersInChannel, setCommander} from 'src/client';
import {Incident} from 'src/types/incident';
import ProfileSelector from 'src/components/profile/profile_selector';
import Duration from '../duration';
import './incident_details.scss';
import Stage from 'src/components/rhs/stage';
import {
    renderThumbHorizontal,
    renderThumbVertical,
    renderView,
} from 'src/components/rhs/rhs_shared';
import RHSFooterSummary from 'src/components/rhs/rhs_footer_summary';
import LatestUpdate from 'src/components/rhs/latest_update';

interface Props {
    incident: Incident;
}

const RHSIncidentSummary: FC<Props> = (props: Props) => {
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
        <>
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
                            />
                        </div>
                        <div className='first-title'>
                            {'Duration'}
                            <Duration
                                created_at={props.incident.create_at}
                                ended_at={props.incident.end_at}
                            />
                        </div>
                    </div>
                    <Stage incident={props.incident}/>
                    <div>
                        <div className='title'>
                            {'Recent Update:'}
                        </div>
                        <LatestUpdate posts_ids={props.incident.status_posts_ids}/>
                    </div>
                </div>
            </Scrollbars>
            <RHSFooterSummary/>
        </>
    );
};

export default RHSIncidentSummary;
