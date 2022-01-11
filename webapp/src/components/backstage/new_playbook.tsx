import React from 'react';
import {Redirect} from 'react-router-dom';

import PlaybookEdit from 'src/components/backstage/playbook_edit/playbook_edit';
import {useAllowPlaybookCreationInTeams} from 'src/hooks';
import {pluginUrl} from 'src/browser_routing';

export const NewPlaybook = () => {
    const allowedTeams = useAllowPlaybookCreationInTeams();
    const searchParams = Object.fromEntries(new URLSearchParams(location.search));

    if (!searchParams.teamId || !allowedTeams.get(searchParams.teamId)) {
        return <Redirect to={pluginUrl('/playbooks')}/>;
    }

    return (
        <PlaybookEdit
            teamId={searchParams.teamId}
            name={searchParams.name}
            template={searchParams.template}
            description={searchParams.description}
            public={searchParams.public !== 'false'}
            isNew={true}
        />
    );
};
