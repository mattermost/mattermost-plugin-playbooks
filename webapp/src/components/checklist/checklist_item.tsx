// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ChecklistItem} from 'src/types/playbook';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    onChange?: (item: boolean) => void;
}

export const ChecklistItemDetails = ({checklistItem, onChange}: ChecklistItemDetailsProps): React.ReactElement<ChecklistItemDetailsProps> => {
    return (
        <div className='checkbox-container'>
            <input
                className='checkbox'
                type='checkbox'
                checked={checklistItem.checked}
                onClick={() => {
                    if (onChange) {
                        onChange(!checklistItem.checked);
                    }
                }}
            />
            <label>{checklistItem.title}</label>
        </div>
    );
};
