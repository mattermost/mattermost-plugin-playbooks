// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {TertiaryButton} from 'src/components/assets/buttons';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {DraftPlaybookWithChecklist, Metric, MetricType, newMetric, PlaybookWithChecklist} from 'src/types/playbook';
import MetricEdit from 'src/components/backstage/playbook_edit/metric_edit';
import MetricView from 'src/components/backstage/playbook_edit/metric_view';
import {DollarSign, PoundSign} from 'src/components/backstage/playbook_edit/styles';

enum TaskType {
    add,
    edit,
}

interface Task {
    type: TaskType;
    addType?: MetricType;
    editIndex?: number;
}

interface Props {
    playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist;
    setPlaybook: React.Dispatch<React.SetStateAction<DraftPlaybookWithChecklist | PlaybookWithChecklist>>;
    setChangesMade: (b: boolean) => void;
}

const Metrics = ({playbook, setPlaybook, setChangesMade}: Props) => {
    const {formatMessage} = useIntl();
    const [curEditingIdx, setCurEditingIdx] = useState(-1);
    const [saveMetricToggle, setSaveMetricToggle] = useState(false);
    const [nextTask, setNextTask] = useState<Task | null>(null);

    const requestAddMetric = (addType: MetricType) => {
        // Only add a new metric if we aren't currently editing.
        if (curEditingIdx === -1) {
            addMetric(addType);
            return;
        }

        // We're editing. Try to close it, and if successful add the new metric.
        setNextTask({type: TaskType.add, addType});
        setSaveMetricToggle((prevState) => !prevState);
    };

    const requestEditMetric = (idx: number) => {
        // Edit a metric immediately if we aren't currently editing.
        if (curEditingIdx === -1) {
            setCurEditingIdx(idx);
            return;
        }

        // We're editing. Try to close it, and if successful edit the metric.
        setNextTask({type: TaskType.edit, editIndex: idx});
        setSaveMetricToggle((prevState) => !prevState);
    };

    const addMetric = (metricType?: MetricType) => {
        const addType = metricType || nextTask?.addType;

        if (!addType) {
            return;
        }

        const newIdx = playbook.metrics.length;
        setPlaybook((pb) => ({
            ...pb,
            metrics: [...pb.metrics, newMetric(addType, newIdx)],
        }));
        setChangesMade(true);
        setCurEditingIdx(newIdx);
    };

    const saveMetric = (metric: Metric) => {
        setPlaybook((pb) => {
            const metrics = [...pb.metrics];
            metrics.splice(metric.order, 1, metric);

            return {
                ...pb,
                metrics,
            };
        });
        setChangesMade(true);
        setCurEditingIdx(-1);

        // Do we have a requested task ready to do next?
        if (nextTask?.type === TaskType.add) {
            setNextTask(null);
            addMetric();
        } else if (nextTask?.type === TaskType.edit) {
            setNextTask(null);

            // The following is because if editIndex === 0, 0 is falsey
            // eslint-disable-next-line no-undefined
            const index = nextTask.editIndex === undefined ? -1 : nextTask.editIndex;
            setCurEditingIdx(index);
        }
    };

    return (
        <div>
            {
                playbook.metrics.map((metric) => {
                    if (metric.order === curEditingIdx) {
                        return (
                            <MetricEdit
                                key={metric.order}
                                metric={metric}
                                otherTitles={playbook.metrics.flatMap((m) => (m.order === metric.order ? [] : m.title))}
                                onAdd={saveMetric}
                                saveToggle={saveMetricToggle}
                                saveFailed={() => setNextTask(null)}
                            />
                        );
                    }
                    return (
                        <MetricView
                            key={metric.order}
                            metric={metric}
                            editClick={() => requestEditMetric(metric.order)}
                        />
                    );
                })
            }
            <DotMenu
                dotMenuButton={TertiaryButton}
                icon={
                    <>
                        <i className='icon-plus'/>
                        {formatMessage({defaultMessage: 'Add Metric'})}
                    </>
                }
                disabled={playbook.metrics.length >= 4}
                topPx={-170}
                leftPx={20}
            >
                <DropdownMenuItem onClick={() => requestAddMetric(MetricType.Duration)}>
                    <MetricTypeOption
                        icon={<i className='icon-clock-outline'/>}
                        title={formatMessage({defaultMessage: 'Duration (in dd:hh:mm)'})}
                        description={formatMessage({defaultMessage: 'e.g., Time to acknowledge, Time to resolve'})}
                    />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => requestAddMetric(MetricType.Currency)}>
                    <MetricTypeOption
                        icon={<DollarSign size={1.2}/>}
                        title={formatMessage({defaultMessage: 'Dollars'})}
                        description={formatMessage({defaultMessage: 'e.g., Cost, Purchases'})}
                    />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => requestAddMetric(MetricType.Integer)}>
                    <MetricTypeOption
                        icon={<PoundSign size={1.2}/>}
                        title={formatMessage({defaultMessage: 'Integer'})}
                        description={formatMessage({defaultMessage: 'e.g., Resource count, Customers affected'})}
                    />
                </DropdownMenuItem>
            </DotMenu>
        </div>
    );
};

interface MetricTypeProps {
    icon: JSX.Element;
    title: string;
    description: string;
}

const MetricTypeOption = ({icon, title, description}: MetricTypeProps) => (
    <HorizontalContainer>
        {icon}
        <VerticalContainer>
            <OptionTitle>{title}</OptionTitle>
            <OptionDesc>{description}</OptionDesc>
        </VerticalContainer>
    </HorizontalContainer>
);

const HorizontalContainer = styled.div`
    display: flex;
    align-items: start;

    > i {
        color: rgba(var(--center-channel-color-rgb), 0.56);
        margin-top: 2px;
    }

    > svg {
        color: rgba(var(--center-channel-color-rgb), 0.56);
        margin: 2px 7px 0 0;
    }
`;

const VerticalContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const OptionTitle = styled.div`
    font-size: 14px;
    line-height: 20px;
`;

const OptionDesc = styled.div`
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

export default Metrics;
