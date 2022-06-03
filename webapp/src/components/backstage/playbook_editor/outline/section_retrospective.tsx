// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {useAllowRetrospectiveAccess} from 'src/hooks';

import {Card} from 'src/components/backstage/playbooks/playbook_preview_cards';
import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';

import {Metric, PlaybookWithChecklist} from 'src/types/playbook';

import {SidebarBlock} from 'src/components/backstage/playbook_edit/styles';
import Metrics from 'src/components/backstage/playbook_edit/metrics/metrics';
import {BackstageSubheader, BackstageSubheaderDescription, StyledMarkdownTextbox, StyledSelect} from 'src/components/backstage/styles';
import MarkdownEdit from 'src/components/markdown_edit';
import {savePlaybook} from 'src/client';

export interface EditingMetric {
    index: number;
    metric: Metric;
}

const retrospectiveReminderOptions = [
    {value: 0, label: 'Once'},
    {value: 3600, label: '1hr'},
    {value: 14400, label: '4hr'},
    {value: 86400, label: '24hr'},
    {value: 604800, label: '7days'},
] as const;

interface Props {
    playbook: Loaded<FullPlaybook>;
    refetch: () => void;
}

const SectionRetrospective = ({playbook, refetch}: Props) => {
    const {formatMessage} = useIntl();
    const retrospectiveAccess = useAllowRetrospectiveAccess();
    const [curEditingMetric, setCurEditingMetric] = useState<EditingMetric | null>(null);
    const updatePlaybook = useUpdatePlaybook(playbook.id);
    const archived = playbook.delete_at !== 0;

    if (!retrospectiveAccess) {
        return null;
    }

    if (!playbook.retrospective_enabled) {
        return <FormattedMessage defaultMessage='A retrospective is not expected.'/>;
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
                <StyledSelect
                    value={retrospectiveReminderOptions.find((option) => option.value === playbook.retrospective_reminder_interval_seconds)}
                    onChange={(option: {label: string; value: number;}) => {
                        updatePlaybook({
                            retrospectiveReminderIntervalSeconds: option?.value,
                        });
                    }}
                    options={retrospectiveReminderOptions}
                    isClearable={false}
                    isDisabled={!playbook.retrospective_enabled || archived}
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
                    playbook={playbook as PlaybookWithChecklist} // TODO reduce prop scope to min-essentials
                    setPlaybook={async (update) => {
                        await savePlaybook({...playbook, ...typeof update === 'function' ? update(playbook as PlaybookWithChecklist) : update}); // TODO replace with graphql / useUpdatePlaybook
                        refetch();
                    }}
                    curEditingMetric={curEditingMetric}
                    setCurEditingMetric={setCurEditingMetric}
                    disabled={!playbook.retrospective_enabled || archived}
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
                    disabled={!playbook.retrospective_enabled || archived}
                />
            </SidebarBlock>
        </Card>
    );
};

export default SectionRetrospective;
