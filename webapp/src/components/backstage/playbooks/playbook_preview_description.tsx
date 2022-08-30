// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

import {useDefaultMarkdownOptions} from 'src/components/formatted_markdown';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {messageHtmlToComponent, formatText} from 'src/webapp_globals';

import Section from 'src/components/backstage/playbooks/playbook_preview_section';

interface Props {
    id: string;
    playbook: PlaybookWithChecklist;
}

const PlaybookPreviewDescription = (props: Props) => {
    const {formatMessage} = useIntl();
    const markdownOptions = useDefaultMarkdownOptions({team: props.playbook.team_id});
    const messageHtmlToComponentOptions = {
        hasPluginTooltips: true,
    };

    const renderMarkdown = (msg: string) => messageHtmlToComponent(formatText(msg, markdownOptions), true, messageHtmlToComponentOptions);

    if (props.playbook.description.trim() === '') {
        return null;
    }

    return (
        <Section
            id={props.id}
            title={formatMessage({defaultMessage: 'Description'})}
        >
            <Description>
                {renderMarkdown(props.playbook.description)}
            </Description>
        </Section>
    );
};

const Description = styled.div`
    font-size: 14px;
    line-height: 20px;

    color: rgba(var(--center-channel-color-rgb), 0.72);

    white-space: pre-wrap;

    p:last-child {
        margin-bottom: 0;
    }
`;

export default PlaybookPreviewDescription;
