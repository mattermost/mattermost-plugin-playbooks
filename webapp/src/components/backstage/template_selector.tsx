// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import Icon from '@mdi/react';
import {mdiRocketLaunchOutline, mdiHandshakeOutline, mdiCodeBraces} from '@mdi/js';

import {DraftPlaybookWithChecklist, emptyPlaybook, newChecklistItem} from 'src/types/playbook';
import FileIcon from 'src/components/assets/icons/file_icon';
import AlertIcon from 'src/components/assets/icons/alert_icon';
import {useAllowPlaybookCreationInCurrentTeam} from 'src/hooks';

import UpgradeBadge from 'src/components/backstage/upgrade_badge';

export interface PresetTemplate {
    title: string;
    icon: JSX.Element;
    template: DraftPlaybookWithChecklist;
}

const TemplateIcon = styled(Icon)`
    color: var(--mention-highlight-link);
`;

export const PresetTemplates: PresetTemplate[] = [
    {
        title: 'Blank',
        icon: <FileIcon/>,
        template: emptyPlaybook(),
    },
    {
        title: 'Product Release',
        icon: (
            <TemplateIcon
                path={mdiRocketLaunchOutline}
                size={2.5}
            />
        ),
        template: {
            ...emptyPlaybook(),
            title: 'Product Release',
            num_stages: 4,
            checklists: [
                {
                    title: 'Prepare code',
                    items: [
                        newChecklistItem('Triage and check for pending tickets and PRs to merge'),
                        newChecklistItem('Start drafting changelog, feature documentation, and marketing materials'),
                        newChecklistItem('Review and update project dependencies as needed'),
                        newChecklistItem('QA prepares release testing assignments'),
                        newChecklistItem('Merge database upgrade'),
                    ],
                },
                {
                    title: 'Release testing',
                    items: [
                        newChecklistItem('Cut a Release Candidate (RC-1)'),
                        newChecklistItem('QA runs smoke tests on the pre-release build'),
                        newChecklistItem('QA runs automated load tests and upgrade tests on the pre-release build'),
                        newChecklistItem('Triage and merge regression bug fixes'),
                    ],
                },
                {
                    title: 'Prepare release for production',
                    items: [
                        newChecklistItem('QA final approves the release'),
                        newChecklistItem('Cut the final release build and publish'),
                        newChecklistItem('Deploy changelog, upgrade notes, and feature documentation'),
                        newChecklistItem('Confirm minimum server requirements are updated in documentation'),
                        newChecklistItem('Update release download links in relevant docs and webpages'),
                        newChecklistItem('Publish announcements and marketing'),
                    ],
                },
                {
                    title: 'Post-release',
                    items: [
                        newChecklistItem('Schedule a release retrospective'),
                        newChecklistItem('Add dates for the next release to the release calendar and communicate to stakeholders'),
                        newChecklistItem('Compose release metrics'),
                        newChecklistItem('Prepare security update communications'),
                        newChecklistItem('Archive the incident channel and create a new one for the next release'),
                    ],
                },
            ],
            create_public_playbook_run: false,
            message_on_join_enabled: true,
            message_on_join:
                'Hello and welcome!\n\n' +
                'This channel was created as part of the **Product Release** playbook and is where conversations related to this release are held. You can customize this message using markdown so that every new channel member can be welcomed with helpful context and resources.',
            categorize_channel_enabled: true,
            description:
                '**About**\n' +
                '- Version number: TBD\n' +
                '- Target-date: TBD\n' +
                '\n' +
                '**Resources**\n' +
                '- Jira filtered view: [link TBC](#)\n' +
                '- Blog post draft: [link TBC](#)\n',
            reminder_message_template:
                '**Changes since last update**\n' +
                '\n' +
                '**Outstanding PRs**\n' +
                '\n',
            reminder_timer_default_seconds: 24 * 60 * 60, // 24 hours
            retrospective_template:
                'Start\n' +
                '\n' +
                'Stop\n' +
                '\n' +
                'Keep\n' +
                '\n',
            retrospective_reminder_interval_seconds: 0, // Once
        },
    },
    {
        title: 'Customer Onboarding',
        icon: (
            <TemplateIcon
                path={mdiHandshakeOutline}
                size={2.5}
            />
        ),
        template: {
            ...emptyPlaybook(),
            title: 'Customer Onboarding',
            num_stages: 4,
            checklists: [
                {
                    title: 'Sales to Post-Sales Handoff',
                    items: [
                        newChecklistItem('AE intro CSM and CSE to key contacts'),
                        newChecklistItem('Create customer account Drive folder'),
                        newChecklistItem('Welcome email within 24hr of Closed Won'),
                        newChecklistItem('Schedule initial kickoff call with customer'),
                        newChecklistItem('Create account plan (Tier 1 or 2)'),
                        newChecklistItem('Send discovery Survey'),
                    ],
                },
                {
                    title: 'Customer Technical Onboarding',
                    items: [
                        newChecklistItem('Schedule technical discovery call'),
                        newChecklistItem('Review current Zendesk tickets and updates'),
                        newChecklistItem('Log customer technical details in Salesforce'),
                        newChecklistItem('Confirm customer received technical discovery summary package'),
                        newChecklistItem('Send current Mattermost “Pen Test” report to customer'),
                        newChecklistItem('Schedule plugin/integration planning session'),
                        newChecklistItem('Confirm data migration plans'),
                        newChecklistItem('Extend Mattermost with integrations'),
                        newChecklistItem('Confirm functional & load test plans'),
                        newChecklistItem('Confirm team/channel organization'),
                        newChecklistItem('Sign up for Mattermost blog for releases and announcements'),
                        newChecklistItem('Confirm next upgrade version'),
                    ],
                },
                {
                    title: 'Go-Live',
                    items: [
                        newChecklistItem('Order Mattermost swag package for project team'),
                        newChecklistItem('Confirm end-user roll-out plan'),
                        newChecklistItem('Confirm customer go-live'),
                        newChecklistItem('Perform post go-live retrospective'),
                    ],
                },
                {
                    title: 'Optional value prompts after go-live',
                    items: [
                        newChecklistItem('Intro playbooks and boards'),
                        newChecklistItem('Inform upgrading Mattermost 101'),
                        newChecklistItem('Share tips & tricks w/ DevOps focus'),
                        newChecklistItem('Share tips & tricks w/ efficiency focus'),
                        newChecklistItem('Schedule quarterly roadmap review w/ product team'),
                        newChecklistItem('Review with executives (Tier 1 or 2)'),
                    ],
                },
            ],
            create_public_playbook_run: false,
            message_on_join_enabled: true,
            message_on_join:
                'Hello and welcome!\n\n' +
                'This channel was created as part of the **Customer Onboarding** playbook and is where conversations related to this customer are held. You can customize this message using markdown so that every new channel member can be welcomed with helpful context and resources.',
            categorize_channel_enabled: true,
            description:
                '**About**\n' +
                '- Account name: [TBD](#)\n' +
                '- Salesforce opportunity: [TBD](#)\n' +
                '- Order type:\n' +
                '- Close date:\n' +
                '\n' +
                '**Team**\n' +
                '- Sales Rep: @TBD\n' +
                '- Customer Success Manager: @TBD\n',
            retrospective_template:
                'What went well?\n' +
                '\n' +
                'What could’ve gone better?\n' +
                '\n' +
                'What should be changed for next time?\n' +
                '\n',
            retrospective_reminder_interval_seconds: 0, // Once
        },
    },
    {
        title: 'Service Reliability Incident',
        icon: <AlertIcon/>,
        template: {
            ...emptyPlaybook(),
            title: 'Service Reliability Incident',
            num_stages: 4,
            checklists: [
                {
                    title: 'Setup for triage',
                    items: [
                        newChecklistItem('Add on-call engineer to channel'),
                        newChecklistItem('Start bridge call', '', '/zoom start'),
                        newChecklistItem('Update description with current situation'),
                        newChecklistItem('Create an incident ticket', '', '/jira create'),
                        newChecklistItem('Assign severity in description (ie. #sev-2)'),
                        newChecklistItem('(If #sev-1) Notify @vip'),
                    ],
                },
                {
                    title: 'Investigate cause',
                    items: [
                        newChecklistItem('Add suspected causes here and check off if eliminated'),
                    ],
                },
                {
                    title: 'Resolution',
                    items: [
                        newChecklistItem('Confirm issue has been resolved'),
                        newChecklistItem('Notify customer success managers'),
                        newChecklistItem('(If sev-1) Notify leader team'),
                    ],
                },
                {
                    title: 'Retrospective',
                    items: [
                        newChecklistItem('Send out survey to participants'),
                        newChecklistItem('Schedule post-mortem meeting'),
                        newChecklistItem('Save key messages as timeline entries'),
                        newChecklistItem('Publish retrospective report'),
                    ],
                },
            ],
            create_public_playbook_run: false,
            message_on_join_enabled: true,
            message_on_join:
                'Hello and welcome!\n\n' +
                'This channel was created as part of the **Service Reliability Incident** playbook and is where conversations related to this release are held. You can customize this message using markdown so that every new channel member can be welcomed with helpful context and resources.',
            categorize_channel_enabled: true,
            description:
                '**Summary**\n' +
                '\n' +
                '**Customer impact**\n' +
                '\n' +
                '**About**\n' +
                '- Severity: #sev-1/2/3\n' +
                '- Responders:\n' +
                '- ETA to resolution:\n',
            reminder_message_template: '',
            reminder_timer_default_seconds: 60 * 60, // 1 hour
            retrospective_template:
                '### Summary\n' +
                'This should contain 2-3 sentences that give a reader an overview of what happened, what was the cause, and what was done. The briefer the better as this is what future teams will look at first for reference.\n' +
                '\n' +
                '### What was the impact?\n' +
                'This section describes the impact of this playbook run as experienced by internal and external customers as well as stakeholders.\n' +
                '\n' +
                '### What were the contributing factors?\n' +
                'This playbook may be a reactive protocol to a situation that is otherwise undesirable. If that\'s the case, this section explains the reasons that caused the situation in the first place. There may be multiple root causes - this helps stakeholders understand why.\n' +
                '\n' +
                '### What was done?\n' +
                'This section tells the story of how the team collaborated throughout the event to achieve the outcome. This will help future teams learn from this experience on what they could try.\n' +
                '\n' +
                '### What did we learn?\n' +
                'This section should include perspective from everyone that was involved to celebrate the victories and identify areas for improvement. For example: What went well? What didn\'t go well? What should be done differently next time?\n' +
                '\n' +
                '### Follow-up tasks\n' +
                'This section lists the action items to turn learnings into changes that help the team become more proficient with iterations. It could include tweaking the playbook, publishing the retrospective, or other improvements. The best follow-ups will have a clear owner assigned as well as due date.\n' +
                '\n' +
                '### Timeline Highlights\n' +
                'This section is a curated log that details the most important moments. It can contain key communications, screen shots, or other artifacts. Use the built-in timeline feature to help you retrace and replay the sequence of events.\n',
            retrospective_reminder_interval_seconds: 24 * 60 * 60, // 24 hours
            signal_any_keywords_enabled: true,
            signal_any_keywords: ['sev-1', 'sev-2', '#incident', 'this is serious'],
        },
    },
    {
        title: 'Feature Swimlane',
        icon: (
            <TemplateIcon
                path={mdiCodeBraces}
                size={2.5}
            />
        ),
        template: {
            ...emptyPlaybook(),
            title: 'Feature Swimlane',
        },
    },
];

const RootContainer = styled.div`
    display: flex;
    flex-direction: column;
    overflow-x: auto;
    padding: 32px 20px;
    background: rgba(var(--center-channel-color-rgb), 0.03);
`;

// BackgroundColorContainer hides the left dots from showing over the template selector.
const BackgroundColorContainer = styled.div`
    position: relative;
    background: var(--center-channel-bg);
`;

const InnerContainer = styled.div`
    max-width: 1120px;
    width: 100%;
    margin: 0 auto;
`;

const Title = styled.div`
    display: flex;
    align-items: center;

    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
`;

const TemplateItemContainer = styled.div`
    display: flex;
    flex-direction: column;
    cursor: pointer;
    min-width: 198px;
`;

const TemplateItemDiv = styled.div`
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    padding: 20px 0;
    > ${TemplateItemContainer.selector}:nth-child(n+1) {
        margin-right: 24px;
    }
`;

const PositionedUpgradeBadge = styled(UpgradeBadge)`
    margin-left: 8px;
`;

interface Props {
    templates?: PresetTemplate[];
    onSelect: (t: PresetTemplate) => void
}

const TemplateSelector = ({templates = PresetTemplates, onSelect}: Props) => {
    const allowPlaybookCreation = useAllowPlaybookCreationInCurrentTeam();

    return (
        <BackgroundColorContainer>
            <RootContainer>
                <InnerContainer>
                    <Title>
                        {'Create a playbook'}
                        {!allowPlaybookCreation && <PositionedUpgradeBadge/>}
                    </Title>
                    <TemplateItemDiv>
                        {
                            templates.map((template: PresetTemplate) => (
                                <TemplateItem
                                    key={template.title}
                                    title={template.title}
                                    onClick={() => {
                                        onSelect(template);
                                    }}
                                >
                                    {template.icon}
                                </TemplateItem>
                            ))
                        }
                    </TemplateItemDiv>
                </InnerContainer>
            </RootContainer>
        </BackgroundColorContainer>
    );
};

interface TemplateItemProps {
    title: string;
    children: JSX.Element[] | JSX.Element;
    onClick: () => void;
}

const IconContainer = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--center-channel-bg);
    height: 156px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    box-sizing: border-box;
    border-radius: 8px;
`;

const TemplateTitle = styled.div`
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
    padding: 20px 0 0 0;
    text-align: center;
`;

const TemplateItem = (props: TemplateItemProps) => {
    return (
        <TemplateItemContainer
            onClick={props.onClick}
        >
            <IconContainer>{props.children}</IconContainer>
            <TemplateTitle>{props.title}</TemplateTitle>
        </TemplateItemContainer>
    );
};

export default TemplateSelector;
