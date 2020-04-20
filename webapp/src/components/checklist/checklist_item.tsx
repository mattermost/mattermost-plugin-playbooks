// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {ChecklistItem} from 'src/types/playbook';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    disabled: boolean;
    onChange?: (item: boolean) => void;
}

export const ChecklistItemDetails = ({checklistItem, disabled, onChange}: ChecklistItemDetailsProps): React.ReactElement => {
    let timestamp = '';
    if (checklistItem.checked) {
        const checkedModified = new Date(checklistItem.checked_modified);
        timestamp = '(' + checkedModified.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ')';
    }

    return (
        <div
            className={'checkbox-container' + (disabled ? ' light' : '')}
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
                checked={checklistItem.checked}
            />
            <label>{checklistItem.title}{' '}<span className={'light small'}>{timestamp}</span></label>
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
        if (title !== checklistItem.title) {
            onEdit(title);
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
                defaultValue={title}
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
