import React from 'react';
import styled from 'styled-components';

import {FormattedMessage, useIntl} from 'react-intl';
import {useRouteMatch} from 'react-router-dom';

import MarkdownEdit from 'src/components/markdown_edit';
import {PlaybookRun} from 'src/types/playbook_run';
import {getSiteUrl, updatePlaybookRunDescription} from 'src/client';
import CopyLink from 'src/components/widgets/copy_link';
import {Timestamp} from 'src/webapp_globals';

interface Props {
    playbookRun: PlaybookRun;
    id: string
}

const EDIT_TIME = {
    useTime: false,
    units: [
        {within: ['second', -45], display: <FormattedMessage defaultMessage='just now'/>},
        ['minute', -59],
        ['hour', -48],
        ['day', -30],
        ['month', -12],
        'year',
    ],
};

const Summary = (props: Props) => {
    const {formatMessage} = useIntl();
    const {url} = useRouteMatch();

    const title = formatMessage({defaultMessage: 'Summary'});
    const modifiedAt = (
        <Timestamp
            value={props.playbookRun.summary_modified_at}
            {...EDIT_TIME}
        />
    );

    const modifiedAtMessage = (
        <TimestampContainer>
            {formatMessage({defaultMessage: 'Last edited {timestamp}'}, {timestamp: modifiedAt})}
        </TimestampContainer>
    );

    return (
        <>
            <Header>
                <Title>
                    <CopyLink
                        id={`section-link-${props.id}`}
                        to={getSiteUrl() + `${url}#${props.id}`}
                        name={title}
                        area-hidden={true}
                    />
                    {title}
                </Title>
                {props.playbookRun.summary_modified_at > 0 && modifiedAtMessage}
            </Header>
            <MarkdownEdit
                placeholder={formatMessage({defaultMessage: 'Add a run summary'})}
                value={props.playbookRun.summary}
                onSave={(value) => {
                    updatePlaybookRunDescription(props.playbookRun.id, value);
                }}
            />
        </>
    );
};

export default Summary;

const Title = styled.h3`
    font-family: Metropolis, sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    white-space: nowrap;

    ${CopyLink} {
        margin-left: -1.25em;
        opacity: 1;
        transition: opacity ease 0.15s;
    }

    &:not(:hover) ${CopyLink}:not(:hover) {
        opacity: 0;
    }
`;

const Header = styled.div`
    display: flex;
    flex: 1;
`;

const TimestampContainer = styled.div`
    flex-grow: 1;
    display: flex;
    white-space: pre-wrap;

    align-items: center;
    justify-content: flex-end;

    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

