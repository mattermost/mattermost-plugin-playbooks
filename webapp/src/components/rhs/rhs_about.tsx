// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Scrollbars from 'react-custom-scrollbars';
import styled from 'styled-components';
import {useDispatch} from 'react-redux';

import {setOwner} from 'src/client';
import {Incident} from 'src/types/incident';
import ProfileSelector from 'src/components/profile/profile_selector';

import './incident_details.scss';
import {
    renderThumbHorizontal,
    renderThumbVertical,
    renderView,
} from 'src/components/rhs/rhs_shared';
import PostCard from 'src/components/rhs/post_card';
import {useLatestUpdate, useProfilesInCurrentChannel} from 'src/hooks';
import PostText from 'src/components/post_text';
import {updateStatus} from 'src/actions';

import Duration from '../duration';

const Description = styled.div`
    padding: 0 0 14px 0;
`;

const Row = styled.div`
    padding: 0 0 24px 0;
`;

const NoDescription = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    margin-bottom: 10px;
`;

interface Props {
    incident: Incident;
}

const RHSAbout = (props: Props) => {
    const dispatch = useDispatch();
    const profilesInChannel = useProfilesInCurrentChannel();
    const latestUpdatePost = useLatestUpdate(props.incident);

    let description = <PostText text={props.incident.description}/>;
    if (props.incident.status_posts.length === 0) {
        description = (
            <NoDescription>
                {'No description yet. '}
                <a onClick={() => dispatch(updateStatus())}>{'Click here'}</a>
                {' to update status.'}
            </NoDescription>
        );
    }

    const fetchUsers = async () => {
        return profilesInChannel;
    };

    const onSelectedProfileChange = async (userId?: string) => {
        if (!userId) {
            return;
        }
        const response = await setOwner(props.incident.id, userId);
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
                <Description>
                    <div className='title'>
                        {'Description'}
                    </div>
                    {description}
                </Description>
                <Row>
                    <div className='side-by-side'>
                        <div className='inner-container first-container'>
                            <div className='first-title'>{'Owner'}</div>
                            <ProfileSelector
                                selectedUserId={props.incident.owner_user_id}
                                placeholder={'Assign the owner role'}
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
                                from={props.incident.create_at}
                                to={props.incident.end_at}
                            />
                        </div>
                    </div>
                </Row>
                <div id={'incidentRHSUpdates'}>
                    <div className='title'>
                        {'Recent Update:'}
                    </div>
                    <PostCard post={latestUpdatePost}/>
                </div>
            </div>
        </Scrollbars>
    );
};

export default RHSAbout;
