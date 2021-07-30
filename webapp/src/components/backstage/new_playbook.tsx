import React from 'react';
import {Redirect} from 'react-router-dom';

import {useSelector} from 'react-redux';
import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import PlaybookEdit from 'src/components/backstage/playbook_edit';
import {useAllowPlaybookCreationInTeams} from 'src/hooks';
import {teamPluginUrl} from 'src/browser_routing';

interface Props {
    currentTeam: Team
}

export const NewPlaybook = (props: Props) => {
    const allowedTeams = useAllowPlaybookCreationInTeams();

    const searchParams = new URLSearchParams(location.search);
    const teamId = searchParams.get('team_id');
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, teamId || ''));

    if (teamId && !allowedTeams.get(teamId)) {
        return <Redirect to={teamPluginUrl(team ? team.name : props.currentTeam.name, '/playbooks')}/>;
    }

    return (
        <PlaybookEdit
            currentTeam={team || props.currentTeam}
            isNew={true}
        />
    );
};
