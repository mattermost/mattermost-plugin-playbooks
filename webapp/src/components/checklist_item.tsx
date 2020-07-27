// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState, useEffect, FC} from 'react';
import {useSelector} from 'react-redux';
import moment from 'moment';

import {ChannelNamesMap} from 'mattermost-webapp/utils/text_formatting';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {navigateToUrl} from 'src/browser_routing';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';

import Spinner from './assets/icons/spinner';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    onChange?: (item: ChecklistItemState) => void;
    onRedirect?: () => void;
}

// @ts-ignore
const {formatText, messageHtmlToComponent} = window.PostUtils;

export const ChecklistItemDetails = (props: ChecklistItemDetailsProps): React.ReactElement => {
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const relativeTeamUrl = useSelector<GlobalState, string>(getCurrentRelativeTeamUrl);

    const markdownOptions = {
        singleline: true,
        mentionHighlight: false,
        atMentions: true,
        team,
        channelNamesMap,
    };

    let timestamp = '';
    const title = props.checklistItem.title;

    if (props.checklistItem.state === ChecklistItemState.Closed) {
        const stateModified = moment(props.checklistItem.state_modified);

        // Avoid times before 2020 since those are errors
        if (stateModified.isSameOrAfter('2020-01-01')) {
            timestamp = '(' + stateModified.calendar(undefined, {sameDay: 'LT'}) + ')'; //eslint-disable-line no-undefined
        }
    }

    return (
        <div
            className={'checkbox-container live'}
        >
            <ChecklistItemButton
                item={props.checklistItem}
                onChange={(item: ChecklistItemState) => {
                    if (props.onChange) {
                        props.onChange(item);
                    }
                }}
            />
            <label title={title}>
                <div
                    onClick={((e) => handleFormattedTextClick(e, relativeTeamUrl))}
                >
                    {messageHtmlToComponent(formatText(title, markdownOptions), true, {})}
                </div>
            </label>
            <a
                className={'timestamp small'}
                href={`/_redirect/pl/${props.checklistItem.state_modified_post_id}`}
                onClick={(e) => {
                    e.preventDefault();
                    if (!props.checklistItem.state_modified_post_id) {
                        return;
                    }

                    // @ts-ignore
                    window.WebappUtils.browserHistory.push(`/_redirect/pl/${props.checklistItem.state_modified_post_id}`);
                    if (props.onRedirect) {
                        props.onRedirect();
                    }
                }}
            >
                {timestamp}
            </a>
        </div>
    );
};

interface ChecklistItemDetailsEditProps {
    commandInputId: string;
    channelId?: string;
    checklistItem: ChecklistItem;
    suggestionsOnBottom?: boolean;
    onEdit: (newvalue: ChecklistItem) => void;
    onRemove: () => void;
}

export const ChecklistItemDetailsEdit = ({commandInputId, channelId, checklistItem, suggestionsOnBottom, onEdit, onRemove}: ChecklistItemDetailsEditProps): React.ReactElement => {
    const commandInputRef = useRef(null);
    const [title, setTitle] = useState(checklistItem.title);
    const [command, setCommand] = useState(checklistItem.command);

    const submit = () => {
        const trimmedTitle = title.trim();
        const trimmedCommand = command.trim();
        if (trimmedTitle === '') {
            setTitle(checklistItem.title);
            return;
        }
        if (trimmedTitle !== checklistItem.title || trimmedCommand !== checklistItem.command) {
            onEdit({...checklistItem, ...{title: trimmedTitle, command: trimmedCommand}});
        }
    };

    // @ts-ignore
    const AutocompleteTextbox = window.Components.Textbox;

    const suggestionListStyle = suggestionsOnBottom ? 'bottom' : 'top';

    return (
        <div
            className='checkbox-container'
        >
            <i
                className='icon icon-menu pr-2'
            />
            <div className='checkbox-textboxes'>
                <input
                    className='form-control'
                    type='text'
                    value={title}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={submit}
                    placeholder={'Title'}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                            submit();
                        }
                    }}
                    onChange={(e) => {
                        setTitle(e.target.value);
                    }}
                />
                <AutocompleteTextbox
                    ref={commandInputRef}
                    id={commandInputId}
                    channelId={channelId}
                    inputComponent={'input'}
                    createMessage={'/slash command'}
                    onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                            if (commandInputRef.current) {
                                // @ts-ignore
                                commandInputRef.current!.blur();
                            }
                        }
                    }}
                    onChange={(e: React.FormEvent<HTMLInputElement>) => {
                        if (e.target) {
                            const input = e.target as HTMLInputElement;
                            setCommand(input.value);
                        }
                    }}
                    suggestionListStyle={suggestionListStyle}

                    className='form-control'
                    type='text'
                    value={command}
                    onBlur={submit}

                    // the following are required props but aren't used
                    characterLimit={256}
                    onKeyPress={(e: KeyboardEvent) => true}
                />
            </div>
            <span
                onClick={onRemove}
                className='checkbox-container__close'
            >
                <i className='icon icon-close'/>
            </span>
        </div>
    );
};

interface ChecklistItemButtonProps {
    onChange: (item: ChecklistItemState) => void;
    item: ChecklistItem;
}

const ChecklistItemButton: FC<ChecklistItemButtonProps> = (props: ChecklistItemButtonProps) => {
    const [spinner, setSpinner] = useState(false);

    useEffect(() => {
        setSpinner(false);
    }, [props.item]);

    const isCommand = Boolean(props.item.command);

    let title;
    let label;
    let disabled = false;
    let onClick;
    switch (props.item.state) {
    case ChecklistItemState.Open: {
        if (isCommand) {
            label = 'Run';
            title = props.item.command;
            onClick = () => {
                setSpinner(true);
                props.onChange(ChecklistItemState.Closed);
            };
        } else {
            label = 'Start';
            onClick = () => {
                setSpinner(true);
                props.onChange(ChecklistItemState.InProgress);
            };
        }
        break;
    }
    case ChecklistItemState.InProgress: {
        label = 'Finish';
        onClick = () => {
            setSpinner(true);
            props.onChange(ChecklistItemState.Closed);
        };
        break;
    }
    case ChecklistItemState.Closed: {
        disabled = true;
        label = 'Done';
        break;
    }
    }

    return (
        <button
            title={title}
            type='button'
            disabled={disabled}
            onClick={onClick}
        >
            {spinner ? <Spinner/> : label}
        </button>
    );
};

const handleFormattedTextClick = (e: React.MouseEvent<HTMLElement, MouseEvent>, currentRelativeTeamUrl: string) => {
    // @ts-ignore
    const channelMentionAttribute = e.target.getAttributeNode('data-channel-mention');

    if (channelMentionAttribute) {
        e.preventDefault();
        navigateToUrl(currentRelativeTeamUrl + '/channels/' + channelMentionAttribute.value);
    }
};
