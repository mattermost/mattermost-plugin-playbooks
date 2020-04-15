// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {ChecklistItem} from 'src/types/playbook';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    onChange?: (item: boolean) => void;
}

export const ChecklistItemDetails = ({checklistItem, onChange}: ChecklistItemDetailsProps): React.ReactElement<ChecklistItemDetailsProps> => {
    return (
        <div
            className='checkbox-container'
            onClick={() => {
                if (onChange) {
                    onChange(!checklistItem.checked);
                }
            }}
        >
            <input
                className='checkbox'
                type='checkbox'
                checked={checklistItem.checked}
            />
            <label>{checklistItem.title}</label>
        </div>
    );
};

interface ChecklistItemDetailsEditProps {
    checklistItem: ChecklistItem;
    onEdit: (newvalue: string) => void;
    onRemove: () => void;
}

export const ChecklistItemDetailsEdit = ({checklistItem, onEdit, onRemove}: ChecklistItemDetailsEditProps): React.ReactElement<ChecklistItemDetailsEditProps> => {
    const [title, setTitle] = useState(checklistItem.title);

    return (
        <div
            className='checkbox-container'
        >
            <input
                className='checklist-input'
                type='text'
                defaultValue={title}
                onChange={(e) => {
                    setTitle(e.target.value);
                    onEdit(e.target.value);
                }}
            />
            <span
                onClick={onRemove}
                className='btn-close'
            >
                {'×'}
            </span>
        </div>
    );
};
