import React from 'react';
import {Redirect, useParams} from 'react-router-dom';

import {pluginUrl} from 'src/browser_routing';

import PlaybookEdit from './playbook_edit';

interface URLParams {
    playbookId?: string;
    tabId?: string;
}

const PlaybookEditWrapper = () => {
    const urlParams = useParams<URLParams>();

    const searchParams = new URLSearchParams(location.search);
    const teamId = searchParams.get('teamId');

    if (!teamId || !urlParams.playbookId) {
        return <Redirect to={pluginUrl('/playbooks')}/>;
    }

    return (
        <PlaybookEdit
            isNew={false}
            teamId={teamId}
            playbookId={urlParams.playbookId}
            tabId={urlParams.tabId}
        />
    );
};
export default PlaybookEditWrapper;
