// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {useIntl} from 'react-intl';

import {FetchPlaybookRunsParams} from 'src/types/playbook_run';
import {SortableColHeader} from 'src/components/sortable_col_header';

const PlaybookRunListHeader = styled.div`
    padding: 0 1.6rem;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 11px;
    font-weight: 600;
    line-height: 36px;
`;

const HeaderRow = styled.div`
    display: flex;
    align-items: center;
`;

const HeaderFlexCol = styled.div`
    padding: 0 6px;
    min-width: 0;
`;

const StatusCol = styled.div`
    flex: 0 0 150px;
    max-width: 150px;
    padding: 0 6px;
`;

const DurationCol = styled.div`
    flex: 0 0 150px;
    max-width: 150px;
    padding: 0 6px;
`;

const TasksCol = styled.div`
    flex: 0 0 150px;
    max-width: 150px;
    min-width: 120px;
    padding: 0 6px;
`;

const ActionsCol = styled.div`
    flex: 0 0 100px;
    max-width: 100px;
    padding: 0 6px;
`;

interface Props {
    fetchParams: FetchPlaybookRunsParams
    setFetchParams: React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>
}

const RunListHeader = ({fetchParams, setFetchParams}: Props) => {
    const {formatMessage} = useIntl();
    function colHeaderClicked(colName: string) {
        if (fetchParams.sort === colName) {
            // we're already sorting on this column; reverse the direction
            const newDirection = fetchParams.direction === 'asc' ? 'desc' : 'asc';

            setFetchParams((oldParams: FetchPlaybookRunsParams) => {
                return {...oldParams, direction: newDirection, page: 0};
            });
            return;
        }

        // change to a new column; default to descending for time-based columns, ascending otherwise
        let newDirection = 'desc';
        if (['name', 'is_active'].indexOf(colName) !== -1) {
            newDirection = 'asc';
        }

        setFetchParams((oldParams: FetchPlaybookRunsParams) => {
            return {...oldParams, sort: colName, direction: newDirection, page: 0};
        });
    }
    return (
        <PlaybookRunListHeader>
            <HeaderRow>
                <HeaderFlexCol style={{flex: 4}}>
                    <SortableColHeader
                        name={formatMessage({defaultMessage: 'Name'})}
                        direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                        active={fetchParams.sort ? fetchParams.sort === 'name' : false}
                        onClick={() => colHeaderClicked('name')}
                    />
                </HeaderFlexCol>
                <StatusCol>
                    <SortableColHeader
                        name={formatMessage({defaultMessage: 'Status / Last update'})}
                        direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                        active={fetchParams.sort ? fetchParams.sort === 'last_status_update_at' : false}
                        onClick={() => colHeaderClicked('last_status_update_at')}
                    />
                </StatusCol>
                <DurationCol>
                    <SortableColHeader
                        name={formatMessage({defaultMessage: 'Duration / Started on'})}
                        direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                        active={fetchParams.sort ? fetchParams.sort === 'create_at' : false}
                        onClick={() => colHeaderClicked('create_at')}
                    />
                </DurationCol>
                <TasksCol>
                    {formatMessage({defaultMessage: 'Tasks'})}
                </TasksCol>
                <HeaderFlexCol style={{flex: 2}}>
                    {formatMessage({defaultMessage: 'Owner / Participants'})}
                </HeaderFlexCol>
                <ActionsCol>
                    {formatMessage({defaultMessage: 'Actions'})}
                </ActionsCol>
            </HeaderRow>
        </PlaybookRunListHeader>
    );
};

export default RunListHeader;
