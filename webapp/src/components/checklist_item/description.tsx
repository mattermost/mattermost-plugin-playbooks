// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {useSelector} from 'react-redux';
import {Team} from 'mattermost-redux/types/teams';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {formatText, messageHtmlToComponent} from 'src/webapp_globals';
import {ChannelNamesMap} from 'src/types/backstage';

import {CollapsibleChecklistItemDescription} from './inputs';

interface DescriptionProps {
    value: string;
    onEdit: (value: string) => void;
    editingItem: boolean;
    showDescription: boolean;
}

const ChecklistItemDescription = (props: DescriptionProps) => {
    const {formatMessage} = useIntl();
    const placeholder = formatMessage({defaultMessage: 'Add a description(optional)'});

    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const [editedValue, setEditedValue] = useState(props.value);

    const markdownOptions = {
        singleline: true,
        mentionHighlight: false,
        atMentions: true,
        team,
        channelNamesMap,
    };

    useEffect(() => {
        setEditedValue(props.value);
    }, [props.value]);

    const computeHeight = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        e.target.style.height = '5px';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    };

    if (props.editingItem) {
        return (
            <ChecklistItemDescriptionContainer>
                <DescriptionTextArea
                    data-testid='checklist-item-textarea-description'
                    value={editedValue}
                    placeholder={placeholder}
                    onChange={(e) => {
                        setEditedValue(e.target.value);
                        props.onEdit(e.target.value);
                    }}
                    autoFocus={true}
                    onFocus={(e) => {
                        const val = e.target.value;
                        e.target.value = '';
                        e.target.value = val;
                        computeHeight(e);
                    }}
                    onInput={computeHeight}
                />
            </ChecklistItemDescriptionContainer>
        );
    }

    return (
        <CollapsibleChecklistItemDescription expanded={props.showDescription}>
            <RenderedDescription data-testid='rendered-checklist-item-description'>
                {editedValue ? (
                    <RenderedDescription>
                        {messageHtmlToComponent(formatText(editedValue, {...markdownOptions, singleline: false}), true, {})}
                    </RenderedDescription>
                ) : (
                    <PlaceholderText>{placeholder}</PlaceholderText>
                )}
            </RenderedDescription>
        </CollapsibleChecklistItemDescription>
    );
};

const PlaceholderText = styled.span`
    opacity: 0.5;
`;

const commonDescriptionStyle = css`
    border-radius: 5px;
    font-size: 12px;
    line-height: 16px;
    color: var(--center-channel-color-72);

    :hover {
        cursor: text;
    }

    p {
        white - space: pre-wrap;
    }
`;

const RenderedDescription = styled.div`
    ${commonDescriptionStyle}

    p:last-child {
        margin - bottom: 0;
    }
`;

const DescriptionTextArea = styled.textarea`
    ${commonDescriptionStyle} {
    }

    display: block;
    resize: none;
    width: 100%;
    padding: 0px;

    border: none;
    border-radius: 5px;
    box-shadow: none;
    background: none;

    &:focus {
        box - shadow: none;
    }
`;

const ChecklistItemDescriptionContainer = styled.div`
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    max-width: 630px;
    margin: 4px 0 0 35px;
    overflow: hidden;
`;

export default ChecklistItemDescription;
