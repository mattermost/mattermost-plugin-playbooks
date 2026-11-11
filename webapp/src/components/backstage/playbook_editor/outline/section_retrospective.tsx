// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {useAllowRetrospectiveAccess, usePlaybookAttributes} from 'src/hooks';
import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';
import {Metric, PlaybookWithChecklist} from 'src/types/playbook';
import {SidebarBlock} from 'src/components/backstage/playbook_edit/styles';
import Metrics from 'src/components/backstage/playbook_edit/metrics/metrics';
import {BackstageSubheader, BackstageSubheaderDescription} from 'src/components/backstage/styles';
import MarkdownEdit from 'src/components/markdown_edit';
import {savePlaybook} from 'src/client';
import RetrospectiveIntervalSelector from 'src/components/backstage/playbook_editor/outline/inputs/retrospective_interval_selector';

export interface EditingMetric {
    index: number;
    metric: Metric;
}

// Convert GraphQL FullPlaybook to PlaybookWithChecklist format for legacy components
const convertToPlaybookWithChecklist = (playbook: FullPlaybook, propertyFields: any[] = []): PlaybookWithChecklist => {
    if (!playbook) {
        throw new Error('Playbook is required');
    }

    return {
        ...playbook,

        // Add missing calculated fields with default values
        num_stages: playbook.checklists?.length || 0,
        num_steps: playbook.checklists?.reduce((total, checklist) => total + (checklist.items?.length || 0), 0) || 0,
        num_runs: 0, // This would need to be fetched separately
        num_actions: 0, // This would need to be calculated
        last_run_at: 0, // This would need to be fetched separately
        active_runs: 0, // This would need to be fetched separately
        propertyFields: propertyFields || [],
    } as PlaybookWithChecklist;
};

interface Props {
    playbook: Loaded<FullPlaybook>;
    refetch: () => void | Promise<void>;
    canEdit?: boolean;
}

const SectionRetrospective = ({playbook, refetch, canEdit = true}: Props) => {
    const {formatMessage} = useIntl();
    const retrospectiveAccess = useAllowRetrospectiveAccess();
    const [curEditingMetric, setCurEditingMetric] = useState<EditingMetric | null>(null);
    const updatePlaybook = useUpdatePlaybook(playbook.id);
    const propertyFields = usePlaybookAttributes(playbook.id);
    const archived = playbook.delete_at !== 0;
    const inputsDisabled = !playbook.retrospective_enabled || archived || !canEdit;

    // Keep the latest playbook (including optimistic metric edits) so chained
    // savePlaybook calls do not race and overwrite each other with stale metrics.
    const playbookRef = useRef(playbook);
    const saveChainRef = useRef(Promise.resolve());
    const pendingSavesRef = useRef(0);
    useEffect(() => {
        // Skip prop sync while saves (and their awaited refetches) are in flight so
        // an older in-flight response cannot clobber newer optimistic metrics.
        if (pendingSavesRef.current === 0) {
            playbookRef.current = playbook;
        }
    }, [playbook]);

    if (!retrospectiveAccess) {
        return null;
    }

    if (!playbook.retrospective_enabled) {
        return (<RetrospectiveTextContainer>
            <FormattedMessage defaultMessage='A retrospective is not expected.'/>
        </RetrospectiveTextContainer>);
    }

    return (
        <Card>
            <SidebarBlock id={'retrospective-reminder-interval'}>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Retrospective reminder interval'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Reminds the channel at a specified interval to fill out the retrospective.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <RetrospectiveIntervalSelector
                    seconds={playbook.retrospective_reminder_interval_seconds}
                    onChange={(seconds) => {
                        updatePlaybook({
                            retrospectiveReminderIntervalSeconds: seconds,
                        });
                    }}
                    disabled={inputsDisabled}
                />
            </SidebarBlock>
            <SidebarBlock id={'retrospective-metrics'}>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Key metrics'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Configure custom metrics to fill out with the retrospective report.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <Metrics
                    playbook={convertToPlaybookWithChecklist(playbook, propertyFields || [])} // TODO reduce prop scope to min-essentials
                    setPlaybook={(update) => {
                        // Apply the update to the optimistic ref synchronously so a follow-up
                        // delete/add sees the new metrics list, then serialize the PUTs.
                        const current = convertToPlaybookWithChecklist(playbookRef.current, propertyFields || []);
                        const next = typeof update === 'function' ? update(current) : {...current, ...update};
                        playbookRef.current = {...playbookRef.current, ...next};
                        const snapshot = {...playbookRef.current};

                        const run = async () => {
                            pendingSavesRef.current += 1;
                            try {
                                await savePlaybook(snapshot); // TODO replace with graphql / useUpdatePlaybook
                                // Only refetch after a successful PUT, and await it so the
                                // next queued save sees server-assigned metric IDs.
                                await refetch();
                            } finally {
                                pendingSavesRef.current -= 1;
                            }
                        };
                        const chained = saveChainRef.current.then(run, run);
                        saveChainRef.current = chained.then(() => undefined, () => undefined);
                        return chained;
                    }}
                    curEditingMetric={curEditingMetric}
                    setCurEditingMetric={setCurEditingMetric}
                    disabled={inputsDisabled}
                />
            </SidebarBlock>
            <SidebarBlock>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Retrospective template'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Default text for the retrospective.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <MarkdownEdit
                    className={'playbook_retrospective_template'}
                    placeholder={formatMessage({defaultMessage: 'Enter retrospective template'})}
                    value={playbook.retrospective_template}
                    onSave={(value: string) => {
                        updatePlaybook({
                            retrospectiveTemplate: value,
                        });
                    }}
                    disabled={inputsDisabled}
                />
            </SidebarBlock>
        </Card>
    );
};

const RetrospectiveTextContainer = styled.div`
    padding: 0 8px;
`;

const Card = styled.div`
    display: flex;
    width: 100%;
    box-sizing: border-box;
    flex-direction: column;
    padding: 16px;
    padding-right: 20px;
    padding-left: 11px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;
    background: var(--center-channel-bg);
    box-shadow: 0 2px 3px rgba(0 0 0 / 0.08);
`;

export default SectionRetrospective;
