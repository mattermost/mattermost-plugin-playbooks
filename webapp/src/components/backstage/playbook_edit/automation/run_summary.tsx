// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {
    AutomationHeader,
    AutomationTitle,
} from 'src/components/backstage/playbook_edit/automation/styles';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import {StyledMarkdownTextbox} from 'src/components/backstage/styles';

interface Props {
    enabled: boolean;
    onToggle: () => void;
    summary: string;
    onSummaryChanged: (summary: string) => void;
}

const RunSummary = ({enabled, onToggle, summary, onSummaryChanged}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <StyledAutomationHeader>
            <AutomationTitle>
                <Toggle
                    isChecked={enabled}
                    onChange={onToggle}
                />
                <FormattedMessage defaultMessage={'Update the run Summary'}/>
            </AutomationTitle>
            <TextboxWrapper>
                <StyledMarkdownTextbox
                    disabled={!enabled}
                    className={'playbook_description'}
                    id={'playbook_description_edit'}
                    placeholder={formatMessage({defaultMessage: 'Define a template for a concise description that explains each run to its stakeholders.'})}
                    value={summary}
                    setValue={onSummaryChanged}
                />
            </TextboxWrapper>
        </StyledAutomationHeader>
    );
};

const StyledAutomationHeader = styled(AutomationHeader)`
    align-items: start;
    flex-direction: column;
`;

const TextboxWrapper = styled.div`
    margin-top: 2rem;
    width: 100%;
`;

export default RunSummary;
