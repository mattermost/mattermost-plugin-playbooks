// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Checklist, ChecklistItem} from 'src/types/playbook';

import {ChecklistItemDetails} from './checklist_item';

interface ChecklistDetailsProps {
    checklist: Checklist;
    onChange?: (itemNum: number, checked: boolean) => void;
}

export const ChecklistDetails = ({checklist, onChange}: ChecklistDetailsProps): React.ReactElement<ChecklistDetailsProps> => {
    return (
        <div
            key={checklist.title}
            className='inner-container'
        >
            <div className='title'>{checklist.title}</div>
            {checklist.items.map((checklistItem: ChecklistItem, index: number) => {
                return (
                    <ChecklistItemDetails
                        key={checklistItem.title + index}
                        checklistItem={checklistItem}
                        onChange={(checked: boolean) => {
                            if (onChange) {
                                onChange(index, checked);
                            }
                        }}
                    />
                );
            })}
        </div>
    );
};

