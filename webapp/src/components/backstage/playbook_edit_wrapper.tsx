import React from 'react';
import {useParams} from 'react-router-dom';

import './playbook.scss';

import PlaybookEdit from './playbook_edit';

interface URLParams {
    teamId: string;
    playbookId?: string;
    tabId?: string;
}

const PlaybookEditWrapper = () => {
    const urlParams = useParams<URLParams>();
    return (
        <PlaybookEdit
            isNew={false}
            teamId={urlParams.teamId}
            playbookId={urlParams.playbookId}
            tabId={urlParams.tabId}
        />
    );
};
export default PlaybookEditWrapper;
