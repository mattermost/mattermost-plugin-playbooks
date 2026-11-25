// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {TertiaryButton} from 'src/components/assets/buttons';
import {Checklist, ChecklistItemState} from 'src/types/playbook';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';

interface Props {
    run: PlaybookRun;
    onOpenInPlaybooks: () => void;
}

export const countTasks = (checklists: Checklist[]) => {
    let total = 0;
    let done = 0;
    for (const checklist of checklists) {
        for (const item of checklist.items) {
            if (item.condition_action === 'hidden') {
                continue;
            }
            total++;
            if (item.state === ChecklistItemState.Closed || item.state === ChecklistItemState.Skip) {
                done++;
            }
        }
    }
    return {total, done};
};

const EmbeddedChecklistHeader = ({run, onOpenInPlaybooks}: Props) => {
    const {formatMessage} = useIntl();
    const {total, done} = countTasks(run.checklists || []);
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
    const finished = run.current_status === PlaybookRunStatus.Finished;

    return (
        <Header data-testid='embedded-checklist-header'>
            <Row>
                <Title>{run.name}</Title>
                {finished && (
                    <FinishedBadge data-testid='embedded-checklist-finished'>
                        {formatMessage({defaultMessage: 'Finished'})}
                    </FinishedBadge>
                )}
                <Count data-testid='embedded-checklist-count'>
                    {formatMessage({defaultMessage: '{done}/{total} done'}, {done, total})}
                </Count>
                <TertiaryButton
                    size='xs'
                    onClick={onOpenInPlaybooks}
                    data-testid='embedded-checklist-open'
                >
                    {formatMessage({defaultMessage: 'Open in Playbooks'})}
                </TertiaryButton>
            </Row>
            <Track
                role='progressbar'
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
            >
                <Fill style={{width: `${percentage}%`}}/>
            </Track>
        </Header>
    );
};

export default EmbeddedChecklistHeader;

const Header = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 12px 4px;
`;

const Row = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
`;

const Title = styled.div`
    min-width: 0;
    flex: 1 1 120px;
    overflow: hidden;
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const Count = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    line-height: 16px;
`;

const FinishedBadge = styled.span`
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(var(--online-indicator-rgb), 0.12);
    color: var(--online-indicator);
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
`;

const Track = styled.div`
    overflow: hidden;
    height: 4px;
    border-radius: 2px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
`;

const Fill = styled.div`
    height: 100%;
    background: var(--online-indicator);
    transition: width 0.2s ease;
`;
