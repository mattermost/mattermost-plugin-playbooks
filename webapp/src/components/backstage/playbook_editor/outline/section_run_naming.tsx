// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';
import {BackstageSubheader, BackstageSubheaderDescription} from 'src/components/backstage/styles';
import {BaseInput} from 'src/components/assets/inputs';
import {SidebarBlock} from 'src/components/backstage/playbook_edit/styles';
import {TemplateInput} from 'src/components/backstage/playbook_edit/automation/template_input';

interface Props {
    playbook: Loaded<FullPlaybook>;
    updatePlaybook: ReturnType<typeof useUpdatePlaybook>;
    disabled?: boolean;
}

const SectionRunNaming = ({playbook, updatePlaybook, disabled}: Props) => {
    const {formatMessage} = useIntl();
    const toaster = useToaster();

    const playbookRef = useRef(playbook);

    const [prefix, setPrefix] = useState(playbook.run_number_prefix ?? '');
    const [template, setTemplate] = useState(playbook.channel_name_template ?? '');

    useEffect(() => {
        playbookRef.current = playbook;
    }, [playbook]);

    useEffect(() => {
        setPrefix(playbook.run_number_prefix ?? '');
    }, [playbook.run_number_prefix]);

    useEffect(() => {
        setTemplate(playbook.channel_name_template ?? '');
    }, [playbook.channel_name_template]);

    const fieldNames = useMemo(() => (playbook.propertyFields ?? []).map((f) => f.name), [playbook.propertyFields]);

    const handlePrefixChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setPrefix(e.target.value), []);
    const handlePrefixBlur = useCallback(() => {
        if (prefix !== playbookRef.current.run_number_prefix) {
            updatePlaybook({runNumberPrefix: prefix}).catch(() => {
                setPrefix(playbookRef.current.run_number_prefix ?? '');
                toaster.add({
                    content: formatMessage({id: 'playbooks.section_run_naming.prefix_save_error', defaultMessage: 'Failed to save run number prefix'}),
                    toastStyle: ToastStyle.Failure,
                });
            });
        }
    }, [prefix, updatePlaybook, toaster, formatMessage]);

    const handleTemplateBlur = useCallback(() => {
        if (template !== playbookRef.current.channel_name_template) {
            updatePlaybook({channelNameTemplate: template}).catch(() => {
                setTemplate(playbookRef.current.channel_name_template ?? '');
                toaster.add({
                    content: formatMessage({id: 'playbooks.section_run_naming.template_save_error', defaultMessage: 'Failed to save run name template'}),
                    toastStyle: ToastStyle.Failure,
                });
            });
        }
    }, [template, updatePlaybook, toaster, formatMessage]);

    return (
        <Card data-testid='run-naming-section'>
            <SidebarBlock>
                <BackstageSubheader>
                    {formatMessage({id: 'playbooks.section_run_naming.prefix_header', defaultMessage: 'Run number prefix'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({id: 'playbooks.section_run_naming.prefix_description', defaultMessage: 'A prefix prepended to the sequential run number (e.g. INC-). Changing the prefix re-keys all existing runs.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <BaseInput
                    data-testid='run-number-prefix-input'
                    type='text'
                    disabled={disabled}
                    value={prefix}
                    onChange={handlePrefixChange}
                    onBlur={handlePrefixBlur}
                    placeholder={formatMessage({id: 'playbooks.section_run_naming.prefix_placeholder', defaultMessage: 'e.g. INC-'})}
                />
            </SidebarBlock>
            <SidebarBlock>
                <BackstageSubheader>
                    {formatMessage({id: 'playbooks.section_run_naming.template_header', defaultMessage: 'Run name template'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({id: 'playbooks.section_run_naming.template_description', defaultMessage: 'Template for the run and channel name. Use {SEQ} for sequential ID, {OWNER} for run owner, {CREATOR} for run creator, or {FieldName} for attribute values.'}, {SEQ: '{SEQ}', OWNER: '{OWNER}', CREATOR: '{CREATOR}', FieldName: '{FieldName}'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <TemplateInput
                    enabled={!disabled}
                    placeholderText={formatMessage({id: 'playbooks.section_run_naming.template_placeholder', defaultMessage: 'e.g. {SEQ} - Incident'}, {SEQ: '{SEQ}'})}
                    input={template}
                    onChange={setTemplate}
                    onBlur={handleTemplateBlur}
                    fieldNames={fieldNames}
                    maxLength={1024}
                    prefix={prefix}
                    testId='run-name-template'
                />
            </SidebarBlock>
        </Card>
    );
};

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

export default SectionRunNaming;
