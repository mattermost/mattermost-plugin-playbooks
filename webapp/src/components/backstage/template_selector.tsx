// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import styled from 'styled-components';

import {Playbook, emptyPlaybook, newChecklistItem} from 'src/types/playbook';
import FileIcon from 'src/components/assets/icons/file_icon';
import AlertIcon from 'src/components/assets/icons/alert_icon';

export interface PresetTemplate {
    title: string;
    icon: JSX.Element;
    template: Playbook;
}

export const PresetTemplates: PresetTemplate[] = [
    {
        title: 'Blank Playbook',
        icon: <FileIcon/>,
        template: emptyPlaybook(),
    },
    {
        title: 'Incident Response Playbook',
        icon: <AlertIcon/>,
        template: {
            ...emptyPlaybook(),
            title: 'Incident Response Playbook',
            checklists: [
                {
                    title: 'Triage',
                    items: [
                        newChecklistItem('Announce incident type and resources', '', '/echo ""'),
                        newChecklistItem('Acknowledge alert'),
                        newChecklistItem('Get alert info'),
                        newChecklistItem('Invite escalators'),
                        newChecklistItem('Determine priority'),
                        newChecklistItem('Update alert priority'),
                        newChecklistItem('Create a JIRA ticket', '', '/jira create'),
                        newChecklistItem('Find out who’s on call', '', '/genie whoisoncall'),
                        newChecklistItem('Announce incident'),
                        newChecklistItem('Invite on-call lead'),
                    ],
                },
                {
                    title: 'Investigation',
                    items: [
                        newChecklistItem('Perform initial investigation'),
                        newChecklistItem('Escalate to other on-call members (optional)'),
                        newChecklistItem('Escalate to other engineering teams (optional)'),
                    ],
                },
                {
                    title: 'Resolution',
                    items: [
                        newChecklistItem('Close alert'),
                        newChecklistItem('End the incident', '', '/incident end'),
                        newChecklistItem('Schedule a post-mortem'),
                        newChecklistItem('Record post-mortem action items'),
                        newChecklistItem('Update playbook with learnings'),
                        newChecklistItem('Export channel message history', '', '/export'),
                        newChecklistItem('Archive this channel', '', ''),
                    ],
                },
            ],
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

const InnerContainer = styled.div`
    max-width: 1120px;
    width: 100%;
    margin: 0 auto;
`;

const Title = styled.div`
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
        margin-right: 32px;
    }
`;

interface Props {
    templates?: PresetTemplate[];
    onSelect: (t: PresetTemplate) => void
}

const TemplateSelector: FC<Props> = ({templates = PresetTemplates, onSelect}: Props) => {
    return (
        <RootContainer>
            <InnerContainer>
                <Title>{'Start a new playbook'}</Title>
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
