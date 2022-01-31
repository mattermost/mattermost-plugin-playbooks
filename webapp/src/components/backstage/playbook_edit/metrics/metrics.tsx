// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {TertiaryButton} from 'src/components/assets/buttons';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {DraftPlaybookWithChecklist, Metric, MetricType, newMetric, PlaybookWithChecklist} from 'src/types/playbook';
import MetricEdit from 'src/components/backstage/playbook_edit/metrics/metric_edit';
import MetricView from 'src/components/backstage/playbook_edit/metrics/metric_view';
import {DollarSign, PoundSign} from 'src/components/backstage/playbook_edit/styles';
import {EditingMetric} from 'src/components/backstage/playbook_edit/playbook_edit';

enum TaskType {
    add,
    edit,
}

interface Task {
    type: TaskType;
    addType?: MetricType;
    index?: number;
}

interface Props {
    playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist;
    setPlaybook: React.Dispatch<React.SetStateAction<DraftPlaybookWithChecklist | PlaybookWithChecklist>>;
    setChangesMade: (b: boolean) => void;
    curEditingMetric: EditingMetric | null;
    setCurEditingMetric: React.Dispatch<React.SetStateAction<EditingMetric | null>>;
}

const Metrics = ({
    playbook,
    setPlaybook,
    setChangesMade,
    curEditingMetric,
    setCurEditingMetric,
}: Props) => {
    const {formatMessage} = useIntl();
    const [saveMetricToggle, setSaveMetricToggle] = useState(false);
    const [nextTask, setNextTask] = useState<Task | null>(null);

    const requestAddMetric = (addType: MetricType) => {
        // Only add a new metric if we aren't currently editing.
        if (!curEditingMetric) {
            addMetric(addType, playbook.metrics.length);
            return;
        }

        // We're editing. Try to close it, and if successful add the new metric.
        setNextTask({type: TaskType.add, addType});
        setSaveMetricToggle((prevState) => !prevState);
    };

    const requestEditMetric = (index: number) => {
        // Edit a metric immediately if we aren't currently editing.
        if (!curEditingMetric) {
            setCurEditingMetric({
                index,
                metric: {...playbook.metrics[index]},
            });
            return;
        }

        // We're editing. Try to close it, and if successful edit the metric.
        setNextTask({type: TaskType.edit, index});
        setSaveMetricToggle((prevState) => !prevState);
    };

    const addMetric = (metricType: MetricType, index: number) => {
        setCurEditingMetric({
            index,
            metric: newMetric(metricType),
        });

        setChangesMade(true);
    };

    const saveMetric = (target: number) => {
        let length = playbook.metrics.length;

        if (curEditingMetric) {
            const metric = {...curEditingMetric.metric, target};
            setPlaybook((pb) => {
                const metrics = [...pb.metrics];
                metrics.splice(curEditingMetric.index, 1, metric);
                length = metrics.length;

                return {
                    ...pb,
                    metrics,
                };
            });
            setChangesMade(true);
        }

        // Do we have a requested task ready to do next?
        if (nextTask?.type === TaskType.add) {
            // Typescript needs defaults (even though they will be present)
            addMetric(nextTask?.addType || MetricType.Duration, length);
        } else if (nextTask?.type === TaskType.edit) {
            // The following is because if editIndex === 0, 0 is falsey
            // eslint-disable-next-line no-undefined
            const index = nextTask.index === undefined ? -1 : nextTask.index;
            setCurEditingMetric({index, metric: playbook.metrics[index]});
        } else {
            setCurEditingMetric(null);
        }

        setNextTask(null);
    };

    // If we're editing a metric, we need to add (or replace) the curEditing metric into the metrics array
    const metrics = [...playbook.metrics];
    if (curEditingMetric) {
        metrics.splice(curEditingMetric.index, 1, curEditingMetric.metric);
    }

    return (
        <div>
            {
                metrics.map((metric, idx) => {
                    if (idx === curEditingMetric?.index) {
                        return (
                            <MetricEdit
                                key={idx}
                                metric={curEditingMetric.metric}
                                setMetric={(setState) => setCurEditingMetric((prevState) => {
                                    if (prevState) {
                                        return {index: prevState.index, metric: setState(prevState.metric)};
                                    }

                                    // This can't happen
                                    return {index: -1, metric: {} as Metric};
                                })}
                                otherTitles={playbook.metrics.flatMap((m, i) => (i === idx ? [] : m.title))}
                                onAdd={saveMetric}
                                saveToggle={saveMetricToggle}
                                saveFailed={() => setNextTask(null)}
                            />
                        );
                    }
                    return (
                        <MetricView
                            key={idx}
                            metric={metric}
                            editClick={() => requestEditMetric(idx)}
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
                disabled={metrics.length >= 4}
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
