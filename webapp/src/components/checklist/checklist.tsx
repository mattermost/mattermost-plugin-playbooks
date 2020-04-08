// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Checklist, ChecklistItem, ChecklistItemStateChecked} from 'src/types/playbook';

interface ChecklistDetailsProps {
    checklist: Checklist
}

export const ChecklistDetails = ({checklist}:ChecklistDetailsProps): React.ReactElement => {
    return (
        <div
            key={checklist.title}
            className='inner-container'
        >
            <div className='title'>{checklist.title}</div>
                {checklist.items.map((checklistItem: ChecklistItem) => {
                    return ( 
                            <ChecklistItemDetails
                                key={checklistItem.title}
                                checklistItem={checklistItem}
                            />
                    )
                })}
        </div>
    )
}

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem
    onChange?: (item: ChecklistItem) => void
}

export const ChecklistItemDetails = ({checklistItem, onChange}:ChecklistItemDetailsProps): React.ReactElement<ChecklistItemDetailsProps> => {
    const checked = checklistItem.state == ChecklistItemStateChecked
    return (
        <div className='checkbox-container'>
            <input
                className='checkbox'
                type='checkbox'
                checked={checked}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    if (onChange) {
                        onChange(event.target.checked);
                    }
                }}
            />
            <label>{checklistItem.title}</label>
        </div>
    )
}
