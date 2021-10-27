// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';

import {PlaybookWithChecklist} from 'src/types/playbook';

import PlaybookPreviewActions from 'src/components/backstage/playbooks/playbook_preview_actions';
import PlaybookPreviewChecklists from 'src/components/backstage/playbooks/playbook_preview_checklists';
import PlaybookPreviewRetrospective from 'src/components/backstage/playbooks/playbook_preview_retrospective';
import PlaybookPreviewStatusUpdates from 'src/components/backstage/playbooks/playbook_preview_status_updates';

interface Props {
    playbook: PlaybookWithChecklist;
}

const PlaybookPreview = (props: Props) => {
    return (
        <Container>
            <Content>
                <PlaybookPreviewChecklists playbook={props.playbook}/>
                <PlaybookPreviewActions playbook={props.playbook}/>
                <PlaybookPreviewStatusUpdates playbook={props.playbook}/>
                <PlaybookPreviewRetrospective playbook={props.playbook}/>
            </Content>
            <Navbar/>
        </Container>
    );
};

const Container = styled.main`
    display: flex;
    flex-direction: row;
    justify-content: center;
    flex-grow: 1;

    column-gap: 114px;

    padding-top: 40px;

    background-color: rgba(var(--center-channel-color-rgb),0.04);
`;

const Content = styled.div`
    display: flex;
    flex-direction: column;
    max-width: 780px;
    margin-bottom: 40px;

    flex-grow: 1;
`;

const Navbar = styled.nav`
    width: 172px;
    height: 340px;
`;

export default PlaybookPreview;
