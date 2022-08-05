// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {closeBackstageRHS} from 'src/actions';
import {backstageRHS} from 'src/selectors';
import {BackstageRHSSection} from 'src/types/backstage_rhs';

import RunInfo, {RunInfoTitle} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info';
import RunTimeline, {RunTimelineTitle} from 'src/components/backstage/playbook_runs/playbook_run/rhs_timeline';
import RunParticipants, {RunParticipantsTitle} from 'src/components/backstage/playbook_runs/playbook_run/rhs_participants';
import RunStatusUpdates, {RunStatusUpdatesTitle} from 'src/components/backstage/playbook_runs/playbook_run/rhs_status_updates';

import TaskInbox, {TaskInboxTitle} from './task_inbox/task_inbox';

const BackstageRHS = () => {
    const sidebarRef = React.useRef(null);
    const dispatch = useDispatch();
    const isOpen = useSelector(backstageRHS.isOpen);
    const viewMode = useSelector(backstageRHS.viewMode);
    const section = useSelector(backstageRHS.section);

    if (!isOpen) {
        return null;
    }

    const renderTitle = () => {
        switch (section) {
        case BackstageRHSSection.TaskInbox:
            return TaskInboxTitle;

        case BackstageRHSSection.RunInfo:
            return RunInfoTitle;

        case BackstageRHSSection.RunTimeline:
            return RunTimelineTitle;

        case BackstageRHSSection.RunStatusUpdates:
            return RunStatusUpdatesTitle;

        case BackstageRHSSection.RunParticipants:
            return RunParticipantsTitle;

        default:
            throw new Error('Unknown backstage section while rendering title');
        }
    };

    let rhsComponent = null;
    switch (section) {
    case BackstageRHSSection.TaskInbox:
        rhsComponent = <TaskInbox/>;
        break;

    case BackstageRHSSection.RunInfo:
        rhsComponent = <RunInfo/>;
        break;

    case BackstageRHSSection.RunTimeline:
        rhsComponent = <RunTimeline/>;
        break;

    case BackstageRHSSection.RunStatusUpdates:
        rhsComponent = <RunStatusUpdates/>;
        break;

    case BackstageRHSSection.RunParticipants:
        rhsComponent = <RunParticipants/>;

        // rhsComponent = (
        //     <Participants
        //         participantsIds={playbookRun.participant_ids}
        //         playbookRunMetadata={metadata ?? null}
        //     />
        // );
        break;
    }

    return (
        <Container
            id='playbooks-sidebar-right'
            role='complementary'
            ref={sidebarRef}
            isOpen={isOpen}
            className='sidebar--right move--left'
        >
            <Header>
                <HeaderTitle>{renderTitle()}</HeaderTitle>
                <ExpandRight/>
                <HeaderIcon>
                    <i
                        className='icon icon-close'
                        onClick={() => dispatch(closeBackstageRHS())}
                    />
                </HeaderIcon>
            </Header>
            <Body>
                {rhsComponent}
            </Body>
        </Container>
    );
};

export default BackstageRHS;

const Container = styled.div<{isOpen: boolean}>`
    display: ${({isOpen}) => (isOpen ? 'flex' : 'hidden')};
    position: fixed;
    width: 400px;
    height: 100%;
    flex-direction: column;
    border-left: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    right: 0;
    z-index: 5;
    background-color: var(--center-channel-bg);


    @media screen and (min-width: 1600px) {
        width: 500px;
    }

    border-radius: 12px 0px 0px 12px;
    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.12);
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    height: 56px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const HeaderIcon = styled.div`
    display: flex;
    align-self: center;
    justify-content: center;
    cursor: pointer;
    width: 32px;
    height: 32px;
    margin-right: 20px;
    :hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const HeaderTitle = styled.div`
    margin: auto 0 auto 20px;
    line-height: 32px;
    font-size: 16px;
    font-weight: 600;
    color: var(--center-channel-color);
    white-space: nowrap;
`;

const Body = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
`;

export const ExpandRight = styled.div`
    margin-left: auto;
`;
