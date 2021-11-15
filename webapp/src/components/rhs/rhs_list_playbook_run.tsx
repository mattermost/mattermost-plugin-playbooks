// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled, {css} from 'styled-components';

import {PlaybookRun} from 'src/types/playbook_run';
import FormattedDuration from 'src/components/formatted_duration';
import {lastUpdatedByPlaybookRunId} from 'src/selectors';
import {SmallerProfile} from 'src/components/rhs/rhs_shared';
import StatusBadge, {BadgeType} from 'src/components/backstage/status_badge';

const PlaybookRunContainer = styled.div<PlaybookRunContainerProps>`
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-shadow: inset 0px -1px 0px var(--center-channel-color-24);

    ${(props) => props.active && css`
        box-shadow: inset 0px -1px 0px var(--center-channel-color-24), inset 4px 0px 0px var(--button-bg);
    `}
`;

const PlaybookRunTitle = styled.div`
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
    letter-spacing: 0;
    text-align: left;
    margin-bottom: 6px;
`;

const Row = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    font-size: 12px;
    line-height: 20px;
    margin: 1px 0;
`;

const Col1 = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    font-weight: 600;
`;

const Col2 = styled.div`
    display: flex;
    flex-direction: column;
    flex: 3;
    font-weight: 400;
`;

interface PlaybookRunContainerProps {
    active: boolean;
}

const Button = styled.button`
    display: block;
    border: 1px solid var(--button-bg);
    border-radius: 4px;
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    line-height: 9.5px;
    color: var(--button-bg);
    text-align: center;
    padding: 10px 0;
    margin-top: 10px;
`;

interface Props {
    playbookRun: PlaybookRun;
    active: boolean;
    viewPlaybookRun: (playbookRunId: string) => void;
}

const RHSListPlaybookRun = (props: Props) => {
    const lastUpdatedMap = useSelector(lastUpdatedByPlaybookRunId);

    return (
        <PlaybookRunContainer active={props.active}>
            <PlaybookRunTitle>{props.playbookRun.name}</PlaybookRunTitle>
            <Row>
                <Col1>{'Duration:'}</Col1>
                <Col2>
                    <FormattedDuration
                        from={props.playbookRun.create_at}
                        to={props.playbookRun.end_at}
                    />
                </Col2>
            </Row>
            <Row>
                <Col1>{'Status:'}</Col1>
                <Col2>
                    <div>
                        <StatusBadge status={BadgeType[props.playbookRun.current_status]}/>
                    </div>
                </Col2>
            </Row>
            <Row>
                <Col1>{'Last updated:'}</Col1>
                <Col2>
                    <FormattedDuration
                        from={lastUpdatedMap[props.playbookRun.id]}
                        to={0}
                        ago={true}
                    />
                </Col2>
            </Row>
            <Row>
                <Col1>{'Owner:'}</Col1>
                <Col2>
                    <SmallerProfile userId={props.playbookRun.owner_user_id}/>
                </Col2>
            </Row>
            <Button
                onClick={() => props.viewPlaybookRun(props.playbookRun.channel_id)}
                data-testid='go-to-channel'
            >
                {'Go to channel'}
            </Button>
        </PlaybookRunContainer>
    );
};

export default RHSListPlaybookRun;
