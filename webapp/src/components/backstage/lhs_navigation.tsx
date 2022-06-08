import React from 'react';

import styled from 'styled-components';

import {Link} from 'react-router-dom';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {useRunsList} from 'src/hooks/general';
import {pluginUrl} from 'src/browser_routing';
import PlaybookIcon from '../assets/icons/playbook_icon';

const LHSContainer = styled.div`
    width: 240px;
    background-color: var(--sidebar-bg);

    display: flex;
    flex-direction: column;
`;

const defaultRunsFetchParams = {
    page: 0,
    per_page: 10,
    sort: 'last_status_update_at',
    direction: 'desc',
    statuses: [PlaybookRunStatus.InProgress, PlaybookRunStatus.Finished],
};

const RunRow = styled(Link)`
    color: rgb(var(--sidebar-text-rgb))
`;

const LHSNavigation = () => {
    const [playbookRuns] = useRunsList(defaultRunsFetchParams);

    return (
        <LHSContainer>
            {playbookRuns.map((run: PlaybookRun) => {
                return (
                    <RunRow
                        to={pluginUrl(`/runs/${run.id}`)}
                        key={run.id}
                    >
                        <PlaybookIcon/>
                        {run.name}
                    </RunRow>
                );
            })}
        </LHSContainer>
    );
};

export default LHSNavigation;
