// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {updatePlaybookTiming} from 'src/client';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {Checklist} from 'src/types/playbook';
import {
    PlaybookType,
    TIMING_INDUSTRY_NAMES,
    TimingMetric,
    TimingPoint,
    TimingPointType,
} from 'src/types/timing_metrics';
import {Badge} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_waiting_time';

interface Props {
    playbookId: string;
    checklists: Checklist[];
    playbookType: PlaybookType;
    timingMetrics: TimingMetric[];
    canEdit: boolean;
    onSaved: (playbookType: PlaybookType, timingMetrics: TimingMetric[]) => void;
}

const MINUTE = 60 * 1000;

const pointKey = (point: TimingPoint) => (point.type === TimingPointType.RunStarted ? point.type : `${point.type}:${point.item_id}`);

const parsePointKey = (key: string): TimingPoint => {
    const [type, itemId] = key.split(':');
    return type === TimingPointType.RunStarted ? {type: TimingPointType.RunStarted} : {type: type as TimingPointType, item_id: itemId};
};

const emptyMetric = (): TimingMetric => ({
    id: '',
    name: '',
    industry_name: '',
    target_millis: 0,
    start: {type: TimingPointType.RunStarted},
    end: {type: TimingPointType.TaskFinished},
});

const SectionTiming = ({playbookId, checklists, playbookType, timingMetrics, canEdit, onSaved}: Props) => {
    const {formatMessage} = useIntl();
    const toaster = useToaster();
    const [draft, setDraft] = useState<TimingMetric | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDraft(null);
        setEditingId(null);
    }, [playbookId]);

    const tasks = useMemo(() => checklists.flatMap((checklist) => checklist.items.filter((item) => item.id).map((item) => ({
        id: item.id as string,
        title: item.title,
        checklist: checklist.title,
    }))), [checklists]);
    const taskTitles = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);

    const describePoint = (point: TimingPoint) => {
        if (point.type === TimingPointType.RunStarted) {
            return formatMessage({defaultMessage: 'Run started'});
        }
        const title = point.item_id ? taskTitles.get(point.item_id) : undefined;
        if (!title) {
            return formatMessage({defaultMessage: 'Deleted task'});
        }
        return point.type === TimingPointType.TaskStarted ? formatMessage({defaultMessage: '"{title}" started'}, {title}) : formatMessage({defaultMessage: '"{title}" finished'}, {title});
    };

    const save = async (nextType: PlaybookType, nextMetrics: TimingMetric[]) => {
        setSaving(true);
        try {
            const saved = await updatePlaybookTiming(playbookId, nextType, nextMetrics);
            onSaved(saved?.playbook_type ?? nextType, saved?.timing_metrics ?? nextMetrics);
            return true;
        } catch {
            toaster.add({
                content: formatMessage({defaultMessage: 'Failed to save timing metrics.'}),
                toastStyle: ToastStyle.Failure,
            });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const saveDraft = async () => {
        if (!draft) {
            return;
        }
        const next = [...timingMetrics];
        if (editingId) {
            const index = next.findIndex((metric) => metric.id === editingId);
            if (index < 0) {
                setDraft(null);
                setEditingId(null);
                return;
            }
            next[index] = draft;
        } else {
            next.push(draft);
        }
        if (await save(playbookType, next)) {
            setDraft(null);
            setEditingId(null);
        }
    };

    const pointOptions = (includeRunStart: boolean) => (
        <>
            {includeRunStart && <option value={TimingPointType.RunStarted}>{formatMessage({defaultMessage: 'Run started'})}</option>}
            {tasks.map((task) => (
                <optgroup
                    key={task.id}
                    label={`${task.checklist} / ${task.title}`}
                >
                    <option value={`${TimingPointType.TaskStarted}:${task.id}`}>{formatMessage({defaultMessage: '"{title}" started'}, {title: task.title})}</option>
                    <option value={`${TimingPointType.TaskFinished}:${task.id}`}>{formatMessage({defaultMessage: '"{title}" finished'}, {title: task.title})}</option>
                </optgroup>
            ))}
        </>
    );

    const draftValid = draft !== null && draft.name.trim() !== '' && pointKey(draft.start) !== pointKey(draft.end) &&
        (draft.end.type === TimingPointType.RunStarted || Boolean(draft.end.item_id));

    return (
        <Container data-testid='playbook-timing-section'>
            <TypeRow>
                <Label>{formatMessage({defaultMessage: 'Playbook type'})}</Label>
                <select
                    data-testid='playbook-type-select'
                    disabled={!canEdit || saving}
                    value={playbookType}
                    onChange={(e) => save(e.target.value as PlaybookType, timingMetrics)}
                >
                    <option value={PlaybookType.Operational}>{formatMessage({defaultMessage: 'Operational'})}</option>
                    <option value={PlaybookType.Exercise}>{formatMessage({defaultMessage: 'Exercise (left out of reports by default)'})}</option>
                </select>
            </TypeRow>

            {timingMetrics.length === 0 && !draft && (
                <Empty>{formatMessage({defaultMessage: 'Measure the time between two points of a run, such as run start and a task finishing, and compare it to a target.'})}</Empty>
            )}

            {timingMetrics.map((metric, index) => (
                <MetricItem
                    key={metric.id || index}
                    data-testid='playbook-timing-metric'
                >
                    <MetricMain>
                        <MetricName>
                            {metric.name}
                            {metric.industry_name && <Badge>{metric.industry_name}</Badge>}
                        </MetricName>
                        <MetricMeta>
                            {metric.target_millis > 0 ? formatMessage(
                                {defaultMessage: '{start} → {end} · target {minutes, number} min'},
                                {start: describePoint(metric.start), end: describePoint(metric.end), minutes: Math.round(metric.target_millis / MINUTE)},
                            ) : formatMessage(
                                {defaultMessage: '{start} → {end}'},
                                {start: describePoint(metric.start), end: describePoint(metric.end)},
                            )}
                        </MetricMeta>
                    </MetricMain>
                    {canEdit && (
                        <MetricActions>
                            <TertiaryButton
                                onClick={() => {
                                    setDraft({...metric});
                                    setEditingId(metric.id);
                                }}
                            >
                                {formatMessage({defaultMessage: 'Edit'})}
                            </TertiaryButton>
                            <TertiaryButton
                                disabled={saving}
                                onClick={async () => {
                                    if (await save(playbookType, timingMetrics.filter((_, i) => i !== index)) && metric.id === editingId) {
                                        setDraft(null);
                                        setEditingId(null);
                                    }
                                }}
                            >
                                {formatMessage({defaultMessage: 'Remove'})}
                            </TertiaryButton>
                        </MetricActions>
                    )}
                </MetricItem>
            ))}

            {draft && (
                <Form data-testid='playbook-timing-form'>
                    <Field>
                        <Label>{formatMessage({defaultMessage: 'Name'})}</Label>
                        <input
                            data-testid='timing-metric-name'
                            maxLength={64}
                            value={draft.name}
                            placeholder={formatMessage({defaultMessage: 'For example: Time to acknowledge'})}
                            onChange={(e) => setDraft({...draft, name: e.target.value})}
                        />
                    </Field>
                    <Field>
                        <Label>{formatMessage({defaultMessage: 'Industry name'})}</Label>
                        <select
                            data-testid='timing-metric-industry-name'
                            value={draft.industry_name}
                            onChange={(e) => setDraft({...draft, industry_name: e.target.value})}
                        >
                            <option value=''>{formatMessage({defaultMessage: 'None'})}</option>
                            {TIMING_INDUSTRY_NAMES.map((name) => (
                                <option
                                    key={name}
                                    value={name}
                                >
                                    {name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field>
                        <Label>{formatMessage({defaultMessage: 'Starts when'})}</Label>
                        <select
                            data-testid='timing-metric-start'
                            value={pointKey(draft.start)}
                            onChange={(e) => setDraft({...draft, start: parsePointKey(e.target.value)})}
                        >
                            {pointOptions(true)}
                        </select>
                    </Field>
                    <Field>
                        <Label>{formatMessage({defaultMessage: 'Ends when'})}</Label>
                        <select
                            data-testid='timing-metric-end'
                            value={draft.end.item_id ? pointKey(draft.end) : ''}
                            onChange={(e) => setDraft({...draft, end: parsePointKey(e.target.value)})}
                        >
                            <option
                                value=''
                                disabled={true}
                            >
                                {formatMessage({defaultMessage: 'Choose a task'})}
                            </option>
                            {pointOptions(false)}
                        </select>
                    </Field>
                    <Field>
                        <Label>{formatMessage({defaultMessage: 'Target (minutes, optional)'})}</Label>
                        <input
                            data-testid='timing-metric-target'
                            type='number'
                            min={0}
                            value={draft.target_millis ? Math.round(draft.target_millis / MINUTE) : ''}
                            onChange={(e) => setDraft({...draft, target_millis: Math.max(0, Number(e.target.value) || 0) * MINUTE})}
                        />
                    </Field>
                    <FormActions>
                        <TertiaryButton
                            onClick={() => {
                                setDraft(null);
                                setEditingId(null);
                            }}
                        >
                            {formatMessage({defaultMessage: 'Cancel'})}
                        </TertiaryButton>
                        <PrimaryButton
                            data-testid='timing-metric-save'
                            disabled={!draftValid || saving}
                            onClick={saveDraft}
                        >
                            {formatMessage({defaultMessage: 'Save metric'})}
                        </PrimaryButton>
                    </FormActions>
                </Form>
            )}

            {canEdit && !draft && (
                <AddButton
                    data-testid='timing-metric-add'
                    onClick={() => {
                        setDraft(emptyMetric());
                        setEditingId(null);
                    }}
                >
                    <i className='icon-plus icon-16'/>
                    {formatMessage({defaultMessage: 'Add timing metric'})}
                </AddButton>
            )}
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: var(--center-channel-color);
    font-size: 14px;

    select, input {
        height: 32px;
        padding: 0 8px;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
        border-radius: 4px;
        background: var(--center-channel-bg);
        color: var(--center-channel-color);
    }
`;

const TypeRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const Label = styled.label`
    margin: 0;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-weight: 600;
`;

const Empty = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const MetricItem = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
    gap: 12px;
`;

const MetricMain = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const MetricName = styled.div`
    display: flex;
    align-items: center;
    font-weight: 600;
    gap: 6px;
`;

const MetricMeta = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
`;

const MetricActions = styled.div`
    display: flex;
    gap: 4px;
`;

const Form = styled.div`
    display: grid;
    padding: 16px;
    border: 1px solid rgba(var(--button-bg-rgb), 0.32);
    border-radius: 8px;
    gap: 12px;
    grid-template-columns: 1fr 1fr;
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const FormActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    grid-column: 1 / -1;
`;

const AddButton = styled(TertiaryButton)`
    align-self: flex-start;
    gap: 4px;
`;

export default SectionTiming;
