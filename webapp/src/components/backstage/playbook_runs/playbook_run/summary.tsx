import React from 'react';
import styled from 'styled-components';

import {FormattedMessage, useIntl} from 'react-intl';

import MarkdownEdit from 'src/components/markdown_edit';
import {PlaybookRun} from 'src/types/playbook_run';
import {updatePlaybookRunDescription} from 'src/client';
import {Timestamp} from 'src/webapp_globals';
import {AnchorLinkTitle} from '../shared';

interface Props {
    playbookRun: PlaybookRun;
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

const Summary = ({
    playbookRun,
}: Props) => {
    const {formatMessage} = useIntl();

    const title = formatMessage({defaultMessage: 'Summary'});
    const modifiedAt = (
        <Timestamp
            value={playbookRun.summary_modified_at}
            {...EDIT_TIME}
        />
    );

    const modifiedAtMessage = (
        <TimestampContainer>
            {formatMessage({defaultMessage: 'Last edited {timestamp}'}, {timestamp: modifiedAt})}
        </TimestampContainer>
    );

    return (
        <Container>
            <Header>
                <AnchorLinkTitle
                    title={title}
                    id='summary'
                />
                {playbookRun.summary_modified_at > 0 && modifiedAtMessage}
            </Header>
            <MarkdownEdit
                placeholder={formatMessage({defaultMessage: 'Add a run summary'})}
                value={playbookRun.summary}
                onSave={(value) => {
                    updatePlaybookRunDescription(playbookRun.id, value);
                }}
            />
        </Container>
    );
};

export default Summary;

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

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
`;
