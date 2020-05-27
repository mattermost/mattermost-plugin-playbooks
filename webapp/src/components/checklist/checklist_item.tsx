// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import moment from 'moment';

import {isMinimumServerVersion} from 'mattermost-redux/utils/helpers';

import {ChecklistItem} from 'src/types/playbook';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    disabled: boolean;
    onChange?: (item: boolean) => void;
    serverVersion: string;
}

export const ChecklistItemDetails = ({checklistItem, disabled, onChange, serverVersion}: ChecklistItemDetailsProps): React.ReactElement => {
    let timestamp = '';
    if (checklistItem.checked) {
        const checkedModified = moment(checklistItem.checked_modified);

        // Avoid times before 2020 since those are errors
        if (checkedModified.isSameOrAfter('2020-01-01')) {
            timestamp = '(' + checkedModified.calendar(undefined, {sameDay: 'LT'}) + ')'; //eslint-disable-line no-undefined
        }
    }

    return (
        <div
            className={'checkbox-container' + (disabled ? ' light' : '')}
        >
            <div
                onClick={() => {
                    if (!disabled && onChange) {
                        onChange(!checklistItem.checked);
                    }
                }}
            >
                <input
                    className='checkbox'
                    type='checkbox'
                    disabled={disabled}
                    readOnly={!onChange}
                    checked={checklistItem.checked}
                />
                <label>
                    {checklistItem.title}
                </label>
            </div>
            {isMinimumServerVersion(serverVersion, 5, 24) &&
                <a
                    className={'light small'}
                    href={`/_redirect/pl/${checklistItem.checked_post_id}`}
                    onClick={(e) => {
                        e.preventDefault();
                        if (!checklistItem.checked_post_id) {
                            return;
                        }

                        // @ts-ignore
                        window.WebappUtils.browserHistory.push(`/_redirect/pl/${checklistItem.checked_post_id}`);
                    }}
                >
                    {timestamp}
                </a>
            }
        </div>
    );
};

interface ChecklistItemDetailsEditProps {
    checklistItem: ChecklistItem;
    onEdit: (newvalue: string) => void;
    onRemove: () => void;
}

export const ChecklistItemDetailsEdit = ({checklistItem, onEdit, onRemove}: ChecklistItemDetailsEditProps): React.ReactElement => {
    const [title, setTitle] = useState(checklistItem.title);

    const submit = () => {
        const trimmedTitle = title.trim();
        if (trimmedTitle === '') {
            setTitle(checklistItem.title);
            return;
        }
        if (trimmedTitle !== checklistItem.title) {
            onEdit(trimmedTitle);
        }
    };

    return (
        <div
            className='checkbox-container'
        >
            <i
                className='icon icon-menu pr-2'
            />
            <input
                className='form-control'
                type='text'
                value={title}
                onBlur={submit}
                onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                        submit();
                    }
                }}
                onChange={(e) => {
                    setTitle(e.target.value);
                }}
            />
            <span
                onClick={onRemove}
                className='checkbox-container__close'
            >
                <i className='icon icon-close'/>
            </span>
        </div>
    );
};
