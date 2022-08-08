// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import Timeline from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/timeline';
import {PlaybookRun} from 'src/types/playbook_run';
import {Content, TabPageContainer, Title} from 'src/components/backstage/playbook_runs/shared';
import MultiCheckbox from 'src/components/multi_checkbox';
import {useTimelineEvents, useFilter} from 'src/components/backstage/playbook_runs/playbook_run/timeline_utils';

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const FakeButton = styled.div`
    display: inline-flex;
    align-items: center;
    color: var(--button-bg);
    background: var(--button-color-rgb);
    border: 1px solid var(--button-bg);
    border-radius: 4px;
    padding: 0 20px;
    height: 32px;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.15s ease-out;
    margin-left: auto;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.12);
    }

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.16);
    }

    i {
        display: flex;
        font-size: 18px;

        &:before {
            margin: 0 7px 0 0;
        }
    }
`;

const TextContainer = styled.span`
    display: flex;
`;

interface Props {
    playbookRun: PlaybookRun;
    deleteTimelineEvent: (id: string) => void;
}

const TimelineRetro = (props: Props) => {
    const {formatMessage} = useIntl();

    const {options, selectOption, eventsFilter} = useFilter();
    const [filteredEvents] = useTimelineEvents(props.playbookRun, eventsFilter);

    return (
        <TabPageContainer>
            <Header>
                <Title>{formatMessage({defaultMessage: 'Timeline'})}</Title>
                <MultiCheckbox
                    dotMenuButton={FakeButton}
                    options={options}
                    onselect={selectOption}
                    placement='bottom-end'
                    icon={
                        <TextContainer>
                            <i className='icon icon-filter-variant'/>
                            {formatMessage({defaultMessage: 'Filter'})}
                        </TextContainer>
                    }
                />
                {/*
                    <PrimaryButtonNotRight>
                    <i className='icon-download-outline'/>
                    {'Export'}
                    </PrimaryButtonNotRight>
                */}
            </Header>
            <Content>
                <Timeline
                    playbookRun={props.playbookRun}
                    filteredEvents={filteredEvents}
                    deleteTimelineEvent={props.deleteTimelineEvent}
                />
            </Content>
        </TabPageContainer>
    );
};

export default TimelineRetro;

