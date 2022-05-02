// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';

import {selectTeam} from 'mattermost-redux/actions/teams';
import {fetchMyChannelsAndMembers} from 'mattermost-redux/actions/channels';
import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {useDispatch} from 'react-redux';

import {PlaybookWithChecklist} from 'src/types/playbook';
import Section from 'src/components/backstage/playbooks/playbook_preview_section';
import ChecklistList from 'src/components/checklist/checklist_list';

interface Props {
    id: string;
    playbook: PlaybookWithChecklist;
}

const SectionChecklists = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    useEffect(() => {
        const teamId = props.playbook.team_id;
        if (!teamId) {
            return;
        }

        dispatch(selectTeam(teamId));
        dispatch(fetchMyChannelsAndMembers(teamId));
        dispatch(fetchMyCategories(teamId));
    }, [dispatch, props.playbook.team_id]);

    if (props.playbook.checklists.length === 0) {
        return null;
    }

    return (
        <Section
            id={props.id}
            title={formatMessage({defaultMessage: 'Checklists'})}
        >
            <ChecklistList playbook={props.playbook}/>
        </Section>
    );
};

export default SectionChecklists;
