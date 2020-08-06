// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import styled from 'styled-components';

import {Playbook, ChecklistItemState, emptyPlaybook} from 'src/types/playbook';
import FileIcon from 'src/components/assets/icons/file_icon';
import SirenIcon from 'src/components/assets/icons/siren_icon';

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
        icon: <SirenIcon/>,
        template: {
            ...emptyPlaybook(),
            title: 'Incident Response Playbook',
            checklists: [
                {
                    title: 'Triage',
                    items: [
                        {
                            title: 'Announce incident type and resources',
                            command: '/echo ""',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Acknowledge alert',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Get alert info',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Invite escalators',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Determine priority',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Update alert priority',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Create a JIRA ticket',
                            command: '/jira create',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Find out who’s on call',
                            command: '/genie whoisoncall',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Announce incident',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Invite on-call lead',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                    ],
                },
                {
                    title: 'Investigation',
                    items: [
                        {
                            title: 'Perform initial investigation',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Escalate to other on-call members (optional)',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Escalate to other engineering teams (optional)',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                    ],
                },
                {
                    title: 'Resolution',
                    items: [
                        {
                            title: 'Close alert',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'End the incident',
                            command: '/incident end',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Schedule a post-mortem',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Record post-mortem action items',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Update playbook with learnings',
                            command: '',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Export channel message history',
                            command: '/export',
                            state: ChecklistItemState.Open,
                        },
                        {
                            title: 'Archive this channel',
                            command: '/incident archive',
                            state: ChecklistItemState.Open,
                        },
                    ],
                },
            ],
        },
    },
];

const Container = styled.div`
    display: flex;
    flex-direction: column;
    overflow-x: auto;
    padding: 32px 0;
    padding-right: 160px;
    padding-left: 160px;
    background: rgba(var(--center-channel-color-rgb), 0.03);
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
    width: 198px;
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
        <Container>
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
        </Container>
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
