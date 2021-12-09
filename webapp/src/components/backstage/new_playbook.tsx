import React from 'react';
import {Redirect} from 'react-router-dom';

import PlaybookEdit from 'src/components/backstage/playbook_edit/playbook_edit';
import {useAllowPlaybookCreationInTeams} from 'src/hooks';
import {pluginUrl} from 'src/browser_routing';

export const NewPlaybook = () => {
    const allowedTeams = useAllowPlaybookCreationInTeams();
    const searchParams = new URLSearchParams(location.search);
    const teamId = searchParams.get('teamId');

    if (!teamId || !allowedTeams.get(teamId)) {
        return <Redirect to={pluginUrl('/playbooks')}/>;
    }

    return (
        <PlaybookEdit
            teamId={teamId}
            isNew={true}
        />
    );
};
