import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {fetchPlaybookRuns} from 'src/client';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {Checklist, ChecklistItem, ChecklistItemState} from 'src/types/playbook';

import Task from './task';

export const TaskInboxTitle = <FormattedMessage defaultMessage={'Your tasks'}/>;

type TasksWithMore = {
    item: ChecklistItem;
    itemNum: number;
    checklistNum: number;
    playbookRunId: string;
    playbookRunName: string;
    checklistTitle: string;
}

const getTasksFromRuns = (runs: PlaybookRun[], myId: string) => {
    const tasks: TasksWithMore[] = [];
    const shouldItemBeShown = (playbookRun: PlaybookRun, item: ChecklistItem) => {
        const iAmAccountable = item.assignee_id === myId || (item.assignee_id === '' && playbookRun.owner_user_id === myId);
        return item.state === ChecklistItemState.Open && iAmAccountable;
    };
    runs.forEach((run: PlaybookRun) => {
        run.checklists.forEach((checklist: Checklist, checklistNum: number) => {
            checklist.items.forEach((item: ChecklistItem, itemNum: number) => {
                if (shouldItemBeShown(run, item)) {
                    tasks.push({
                        item,
                        checklistNum,
                        itemNum,
                        playbookRunId: run.id,
                        playbookRunName: run.name,
                        checklistTitle: checklist.title,
                    });
                }
            });
        });
    });
    return tasks;
};

const TaskInbox = () => {
    const [runs, setRuns] = useState<PlaybookRun[]>([]);
    const myUserId = useSelector(getCurrentUserId);
    useEffect(() => {
        const options = {
            page: 0,
            per_page: 50,
            statuses: [PlaybookRunStatus.InProgress],
            participant_id: myUserId,
        };
        fetchPlaybookRuns(options)
            .then((res) => setRuns(res.items || []))
            .catch(() => setRuns([]));
    }, [myUserId]);

    const tasks = getTasksFromRuns(runs, myUserId);

    return (
        <Container>
            {tasks.map((task) => (
                <Task
                    key={`${task.playbookRunId}-${task.checklistNum}-${task.itemNum}`}
                    {...task}
                />
            ))}
        </Container>
    );
};

export default TaskInbox;

const Container = styled.div`
`;