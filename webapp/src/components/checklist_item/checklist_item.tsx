// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import ReactDOM from 'react-dom';
import {useIntl} from 'react-intl';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {DraggableProvided} from 'react-beautiful-dnd';

import {handleFormattedTextClick} from 'src/browser_routing';
import {
    clientEditChecklistItem,
} from 'src/client';
import {PrimaryButton, SecondaryButton} from 'src/components/assets/buttons';
import {formatText, messageHtmlToComponent} from 'src/webapp_globals';
import {ChannelNamesMap} from 'src/types/backstage';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';

import ChecklistItemHoverMenu from './hover_menu';
import ChecklistItemDescription from './description';
import AssignTo from './assign_to';
import Command from './command';
import {CheckBoxButton, CollapsibleChecklistItemDescription} from './inputs';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    checklistNum: number;
    itemNum: number;
    channelId: string;
    playbookRunId: string;
    onChange?: (item: ChecklistItemState) => void;
    draggableProvided?: DraggableProvided;
    dragging: boolean;
    disabled: boolean;
    collapsibleDescription: boolean;
}

const ItemContainer = styled.div<{editing: boolean}>`
    margin-top: 11px;
    padding-top: 4px;
    border-radius: 4px;

    :first-child {
        padding-top: 0.4rem;
    }

    

    ${({editing}) => editing && css`
        background-color: var(--button-bg-08);
    `}

    ${({editing}) => !editing && css`
        &:hover{
            background: var(--center-channel-color-08);
        }
    `}
`;

export const CheckboxContainer = styled.div`
    align-items: center;
    display: flex;
    position: relative;

    button {
        width: 53px;
        height: 29px;
        border: 1px solid #166DE0;
        box-sizing: border-box;
        border-radius: 4px;
        font-family: Open Sans;
        font-style: normal;
        font-weight: 600;
        font-size: 12px;
        line-height: 17px;
        text-align: center;
        background: #ffffff;
        color: #166DE0;
        cursor: pointer;
        margin-right: 13px;
    }

    button:disabled {
        border: 0px;
        color: var(--button-color);
        background: rgba(var(--center-channel-color-rgb), 0.56);
        cursor: default;
    }

    &:hover {
        .checkbox-container__close {
            opacity: 1;
        }
    }

    .icon-bars {
        padding: 0 0.8rem 0 0;
    }

    input[type="checkbox"] {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background: #ffffff;
        margin: 0;
        cursor: pointer;
        margin-right: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        min-width: 16px;
        height: 16px;
        border: 1px solid rgba(var(--center-channel-color-rgb),0.24);
        box-sizing: border-box;
        border-radius: 2px;
    }

    input[type="checkbox"]:checked {
        background: var(--button-bg);
        border: 1px solid var(--button-bg);
        box-sizing: border-box;
    }

    input[type="checkbox"]::before {
        font-family: 'compass-icons', mattermosticons;
        text-rendering: auto;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        content: "\f012c";
        font-size: 12px;
        font-weight: bold;
        color: #ffffff;
        transition: transform 0.15s;
        transform: scale(0) rotate(90deg);
        position: relative;
    }

    input[type="checkbox"]:checked::before {
        transform: scale(1) rotate(0deg);
    }

    input[type="checkbox"]:disabled {
        opacity: 0.38;
    }

    label {
        font-weight: normal;
        word-break: break-word;
        display: inline;
        margin: 0;
        margin-right: 8px;
        flex-grow: 1;
    }
`;

const ChecklistItemLabel = styled.div<{clickable: boolean}>`
    display: flex;
    flex-direction: column;
    width: 100%;

    ${({clickable}) => clickable && css`
        cursor: pointer;

        // This is somehow needed to override the
        // cursor style in the item title
        label {
            cursor: pointer;
        }
    `}
`;

const portal: HTMLElement = document.createElement('div');
document.body.appendChild(portal);

export const ChecklistItemDetails = (props: ChecklistItemDetailsProps): React.ReactElement => {
    const {formatMessage} = useIntl();
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const relativeTeamUrl = useSelector<GlobalState, string>(getCurrentRelativeTeamUrl);
    const [showDescription, setShowDescription] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [titleValue, setTitleValue] = useState(props.checklistItem.title);
    const [descValue, setDescValue] = useState(props.checklistItem.description);

    const markdownOptions = {
        singleline: true,
        mentionHighlight: false,
        atMentions: true,
        team,
        channelNamesMap,
    };

    const [showMenu, setShowMenu] = useState(false);

    const title = props.checklistItem.title;
    const labelText = messageHtmlToComponent(formatText(props.checklistItem.title, markdownOptions), true, {});

    const toggleDescription = () => setShowDescription(!showDescription);

    const extraRow = (
        <Row>
            {(props.checklistItem.assignee_id !== '' || isEditing) &&
                <AssignTo
                    assignee_id={props.checklistItem.assignee_id || ''}
                    checklistNum={props.checklistNum}
                    itemNum={props.itemNum}
                    playbookRunId={props.playbookRunId}
                    editable={isEditing}
                    withoutName={props.checklistItem.command !== ''}
                />
            }
            {(props.checklistItem.command !== '' || isEditing) &&
                <Command
                    checklistNum={props.checklistNum}
                    command={props.checklistItem.command}
                    command_last_run={props.checklistItem.command_last_run}
                    disabled={false}
                    itemNum={props.itemNum}
                    playbookRunId={props.playbookRunId}
                />
            }
        </Row>
    );

    let itemLabel = (
        <label title={title}>
            <div
                onClick={((e) => handleFormattedTextClick(e, relativeTeamUrl))}
            >
                {(props.checklistItem.state === ChecklistItemState.Skip) ? <StrikeThrough data-cy={'skipped'}>{labelText}</StrikeThrough> : labelText}
            </div>
        </label>
    );
    let itemDescription = (
        <>
            <CollapsibleChecklistItemDescription expanded={showDescription || isEditing}>
                {/* {messageHtmlToComponent(formatText(props.checklistItem.description, {...markdownOptions, singleline: false}), true, {})} */}
                <ChecklistItemDescription
                    editingItem={isEditing}
                    onEdit={setDescValue}
                    value={props.checklistItem.description}
                />
            </CollapsibleChecklistItemDescription>
            {extraRow}
        </>
    );

    if (isEditing) {
        itemLabel = (
            <LabelInput
                type='input'
                autoFocus={true}
                value={titleValue}
                onChange={(e) => {
                    setTitleValue(e.target.value);
                }}
            />
        );
        itemDescription = (
            <>
                <ChecklistItemDescriptionContainer>
                    <ChecklistItemDescription
                        editingItem={isEditing}
                        onEdit={setDescValue}
                        value={props.checklistItem.description}
                    />
                </ChecklistItemDescriptionContainer>
                {extraRow}
            </>
        );
    }

    const content = (
        <>
            <ItemContainer
                ref={props.draggableProvided?.innerRef}
                {...props.draggableProvided?.draggableProps}
                onMouseEnter={() => setShowMenu(true)}
                onMouseLeave={() => setShowMenu(false)}
                data-testid='checkbox-item-container'
                editing={isEditing}
            >
                <CheckboxContainer>
                    {showMenu && !props.disabled &&
                        <ChecklistItemHoverMenu
                            playbookRunId={props.playbookRunId}
                            checklistNum={props.checklistNum}
                            itemNum={props.itemNum}
                            isSkipped={props.checklistItem.state === ChecklistItemState.Skip}
                            onEdit={() => setIsEditing(true)}
                            isEditing={isEditing}
                            onChange={props.onChange}
                        />
                    }
                    <DragButton
                        title={formatMessage({defaultMessage: 'Drag me to reorder'})}
                        className={'icon icon-drag-vertical'}
                        {...props.draggableProvided?.dragHandleProps}
                        isVisible={showMenu && !props.disabled}
                    />
                    <CheckBoxButton
                        disabled={props.disabled || props.checklistItem.state === ChecklistItemState.Skip}
                        item={props.checklistItem}
                        onChange={(item: ChecklistItemState) => {
                            if (props.onChange) {
                                props.onChange(item);
                            }
                        }}
                    />
                    <ChecklistItemLabel
                        onClick={() => props.collapsibleDescription && props.checklistItem.description !== '' && toggleDescription()}
                        clickable={props.collapsibleDescription && props.checklistItem.description !== ''}
                    >
                        {itemLabel}
                    </ChecklistItemLabel>
                </CheckboxContainer>
                {itemDescription}
                {isEditing &&
                    <CancelSaveContainer>
                        <CancelButton
                            onClick={() => {
                                setIsEditing(false);
                                setTitleValue(props.checklistItem.title);
                                setDescValue(props.checklistItem.description);
                            }}
                        >
                            {'Cancel'}
                        </CancelButton>
                        <SaveButton
                            onClick={() => {
                                setIsEditing(false);
                                clientEditChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum, {
                                    title: titleValue,
                                    command: props.checklistItem.command,
                                    description: descValue,
                                });
                            }}
                        >
                            {'Save'}
                        </SaveButton>
                    </CancelSaveContainer>
                }
            </ItemContainer>
        </>
    );

    if (props.dragging) {
        return ReactDOM.createPortal(content, portal);
    }

    return content;
};

const DragButton = styled.i<{isVisible: boolean}>`
    cursor: pointer;
    width: 4px;
    height: 12px;
    margin-right: 4px; 
    margin-left: 4px;   
    color: rgba(var(--center-channel-color-rgb), 0.56);
    ${({isVisible}) => !isVisible && `
        visibility: hidden
    `}
`;

const CancelButton = styled(SecondaryButton)`
    height: 32px;
    padding: 10px 16px;
    margin: 0px 4px;
    border-radius: 4px;
`;

const SaveButton = styled(PrimaryButton)`
    height: 32px;
    padding: 10px 16px;
    margin: 0px 4px;
    border-radius: 4px;
`;

const StrikeThrough = styled.text`
    text-decoration: line-through;
`;

const CancelSaveContainer = styled.div`
    text-align: right;
    padding: 4px;
`;

const LabelInput = styled.input`
    border: none;
    background: none;
    font-style: normal;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    padding: 0px;
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

const Row = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;

    margin-bottom: 8px;
    margin-left: 35px;
    margin-top: 8px;
`;
