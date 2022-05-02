// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {Children, ReactNode, HTMLAttributes, useEffect} from 'react';
import {useIntl} from 'react-intl';

import {selectTeam} from 'mattermost-redux/actions/teams';
import {fetchMyChannelsAndMembers} from 'mattermost-redux/actions/channels';
import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {useDispatch} from 'react-redux';

import {useLocation} from 'react-router-dom';

import {PlaybookWithChecklist} from 'src/types/playbook';
import ChecklistList from 'src/components/checklist/checklist_list';

import StatusUpdates from './section_status_updates';
import Retrospective from './section_retrospective';
import Actions from './section_actions';

import ScrollNavBase from './scroll_nav';

import Section from './section';

interface Props {
    playbook: PlaybookWithChecklist;
    runsInProgress: number;
}

type Attrs = HTMLAttributes<HTMLElement>;

/** @alpha replace/copy-pasta/unfold sections as-needed*/
const Outline = ({playbook}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    useEffect(() => {
        const teamId = playbook.team_id;
        if (!teamId) {
            return;
        }

        dispatch(selectTeam(teamId));
        dispatch(fetchMyChannelsAndMembers(teamId));
        dispatch(fetchMyCategories(teamId));
    }, [dispatch, playbook.team_id]);

    return (
        <Sections
            playbookId={playbook.id}
            data-testid='preview-content'
        >
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
    const {hash} = useLocation();

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

    useEffect(() => {
        // TODO implement scroll-to-section based on hash
    }, [hash]);

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
