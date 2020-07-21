// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import moment from 'moment';

import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';

import Spinner from './assets/icons/spinner';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    onChange?: (item: ChecklistItemState) => void;
    onRedirect?: () => void;
}

// @ts-ignore
const {formatText, messageHtmlToComponent} = window.PostUtils;

const markdownOptions = {singleline: true, mentionHighlight: false, atMentions: true};

export const ChecklistItemDetails = (props: ChecklistItemDetailsProps): React.ReactElement => {
    const [spinner, setSpinner] = useState(false);

    useEffect(() => {
        setSpinner(false);
    }, [props.checklistItem]);

    let timestamp = '';
    const title = props.checklistItem.title;

    if (props.checklistItem.state === ChecklistItemState.Closed) {
        const stateModified = moment(props.checklistItem.state_modified);

        // Avoid times before 2020 since those are errors
        if (stateModified.isSameOrAfter('2020-01-01')) {
            timestamp = '(' + stateModified.calendar(undefined, {sameDay: 'LT'}) + ')'; //eslint-disable-line no-undefined
        }
    }

    const isCommand = Boolean(props.checklistItem.command);
    let activation = null;
    switch (props.checklistItem.state) {
    case ChecklistItemState.Open: {
        let label = 'Start';
        let hovertext = '';
        if (isCommand) {
            label = 'Run';
            hovertext = props.checklistItem.command;
        }
        activation = (
            <button
                title={hovertext}
                type='button'
                onClick={() => {
                    if (props.onChange) {
                        setSpinner(true);
                        if (isCommand) {
                            props.onChange(ChecklistItemState.Closed);
                        } else {
                            props.onChange(ChecklistItemState.InProgress);
                        }
                    }
                }}
            >
                {spinner ? <Spinner/> : label}
            </button>
        );
        break;
    }
    case ChecklistItemState.InProgress: {
        activation = (
            <button
                type='button'
                onClick={() => {
                    if (props.onChange) {
                        setSpinner(true);
                        props.onChange(ChecklistItemState.Closed);
                    }
                }}
            >
                {'Finish'}
            </button>
        );
        break;
    }
    case ChecklistItemState.Closed: {
        activation = (
            <button
                type='button'
                disabled={true}
            >
                {'Done'}
            </button>
        );
        break;
    }
    }

    return (
        <div
            className={'checkbox-container live'}
        >
            {activation}
            <label title={title}>
                {messageHtmlToComponent(formatText(title, markdownOptions), true, {})}
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
    checklistItem: ChecklistItem;
    onEdit: (newvalue: ChecklistItem) => void;
    onRemove: () => void;
}

export const ChecklistItemDetailsEdit = ({checklistItem, onEdit, onRemove}: ChecklistItemDetailsEditProps): React.ReactElement => {
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
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            submit();
                        }
                    }}
                    onChange={(e) => {
                        setTitle(e.target.value);
                    }}
                />
                <input
                    className='form-control'
                    type='text'
                    value={command}
                    onBlur={submit}
                    placeholder={'/Slash Command'}
                    onClick={(e) => e.stopPropagation()}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            submit();
                        }
                    }}
                    onChange={(e) => {
                        setCommand(e.target.value);
                    }}
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
