// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {Children, ReactNode, HTMLAttributes} from 'react';

import {useIntl} from 'react-intl';

import {PlaybookWithChecklist} from 'src/types/playbook';
import MarkdownEdit from 'src/components/markdown_edit';
import ChecklistList from 'src/components/checklist/checklist_list';

import StatusUpdates from './section_status_updates';
import Retrospective from './section_retrospective';
import Actions from './section_actions';

import ScrollNavBase from './scroll_nav';

import Section from './section';

interface Props {
    playbook: PlaybookWithChecklist;
    updatePlaybook: (diff: Partial<PlaybookWithChecklist>) => void;
    runsInProgress: number;
}

type Attrs = HTMLAttributes<HTMLElement>;

const Outline = ({playbook, updatePlaybook}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <Sections
            playbookId={playbook.id}
            data-testid='preview-content'
        >
            <Section
                id={'summary'}
                title={formatMessage({defaultMessage: 'Summary'})}
            >
                <MarkdownEdit
                    placeholder={formatMessage({defaultMessage: 'Add run summary template...'})}
                    value={playbook.run_summary_template}
                    onSave={(run_summary_template) => {
                        updatePlaybook({run_summary_template});
                    }}
                />
            </Section>
            <Section
                id={'status-updates'}
                title={formatMessage({defaultMessage: 'Status Updates'})}
            >
                <StatusUpdates playbook={playbook}/>
            </Section>
            <Section
                id={'checklists'}
                title={formatMessage({defaultMessage: 'Checklists'})}
            >
                <ChecklistList playbook={playbook}/>
            </Section>
            <Section
                id={'retrospective'}
                title={formatMessage({defaultMessage: 'Retrospective'})}
            >
                <Retrospective playbook={playbook}/>
            </Section>
            <Section
                id={'actions'}
                title={formatMessage({defaultMessage: 'Actions'})}
            >
                <Actions playbook={playbook}/>
            </Section>
        </Sections>
    );
};

export const ScrollNav = styled(ScrollNavBase)`
`;

type SectionItem = {id: string, title: string};

type SectionsProps = {
    playbookId: PlaybookWithChecklist['id'];
    children: ReactNode;
}

const SectionsImpl = ({
    playbookId,
    children,
    ...attrs
}: SectionsProps & Attrs) => {
    const items = Children.toArray(children).reduce<Array<SectionItem>>((result, node) => {
        if (
            React.isValidElement(node) &&
            node.props.id &&
            node.props.title &&
            node.props.children
        ) {
            const {id, title} = node.props;
            result.push({id, title});
        }
        return result;
    }, []);

    return (
        <>
            <ScrollNav
                playbookId={playbookId}
                items={items}
            />
            <div {...attrs}>
                {children}
            </div>
        </>
    );
};

export const Sections = styled(SectionsImpl)`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    margin-bottom: 40px;
    padding: 5rem;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 8px;
    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.12);
    background: var(--center-channel-bg);
`;

export default Outline;
