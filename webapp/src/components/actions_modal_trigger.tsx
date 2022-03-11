// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';

import styled from 'styled-components';

import KeywordsSelector from 'src/components/keywords_selector';
import {ChannelAction, ChannelTriggerType, PromptRunPlaybookFromKeywordsPayload} from 'src/types/channel_actions';

interface Props {
    editable: boolean;
    children: React.ReactNode;
    triggerType: ChannelTriggerType;
    actions: ChannelAction[];
    onUpdate: (newAction: ChannelAction) => void;
}

const titles = {
    [ChannelTriggerType.NewMemberJoins]: <FormattedMessage defaultMessage={'When a user joins the channel'}/>,
    [ChannelTriggerType.KeywordsPosted]: <FormattedMessage defaultMessage={'When a message with these keywords is posted'}/>,
};

const Trigger = (props: Props) => {
    const {formatMessage} = useIntl();

    return (
        <Container>
            <Header>
                <Legend>
                    <Label>{formatMessage({defaultMessage: 'Trigger'})}</Label>
                    <Title>{titles[props.triggerType]}</Title>
                </Legend>
                {props.triggerType === ChannelTriggerType.KeywordsPosted &&
                <TriggerKeywords
                    editable={props.editable}
                    actions={props.actions}
                    onUpdate={props.onUpdate}
                />
                }
            </Header>
            <Body>
                {props.children}
            </Body>
        </Container>
    );
};

interface TriggerKeywordsProps {
    editable: boolean;
    actions: ChannelAction[];
    onUpdate: (newAction: ChannelAction) => void;
}

const TriggerKeywords = ({editable, actions, onUpdate}: TriggerKeywordsProps) => {
    let initialKeywords = [] as string[];
    if (actions.length > 0) {
        // All actions should have the same keywords as trigger, so pick the first one
        const payload = actions[0].payload as PromptRunPlaybookFromKeywordsPayload;
        initialKeywords = payload.keywords;
    }

    const [keywords, setKeywords] = useState(initialKeywords);

    const onKeywordsChange = (newKeywords: string[]) => {
        actions.forEach((action) => {
            onUpdate({
                ...action,
                payload: {
                    ...action.payload,
                    keywords: newKeywords,
                },
            });
        });

        setKeywords(keywords);
    };

    return (
        <StyledKeywordsSelector
            enabled={editable}
            placeholderText={'Add keywords'}
            keywords={keywords}
            onKeywordsChange={onKeywordsChange}
        />
    );
};

const Container = styled.fieldset`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    box-sizing: border-box;

    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.08);
    border-radius: 4px;
`;

const Header = styled.div`
    background: rgba(var(--center-channel-color-rgb), 0.04);

    display: flex;
    flex-direction: column;
    justify-content: space-between;

    padding: 12px 20px;
    padding-right: 27px;
`;

const Legend = styled.legend`
    display: flex;
    flex-direction: column;
    border: none;
    margin: 0;
`;

const Label = styled.span`
    font-size: 11px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const Title = styled.span`
    font-size: 14px;
    font-weight: 600;
    color: var(--center-channel-color);
    margin-top: 2px;
`;

const Body = styled.div`
    padding: 24px;
`;

const StyledKeywordsSelector = styled(KeywordsSelector)`
    margin-top: 8px;
`;

export default Trigger;
