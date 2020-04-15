// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {Checklist, ChecklistItem} from 'src/types/playbook';

import {ChecklistItemDetails, ChecklistItemDetailsEdit} from './checklist_item';

interface ChecklistDetailsProps {
    checklist: Checklist;
    onChange?: (itemNum: number, checked: boolean) => void;
    addItem: (checklistItem: ChecklistItem) => void;
    removeItem: (itemNum: number) => void;
    editItem: (itemNum: number, newTitle: string) => void;
}

export const ChecklistDetails = ({checklist, onChange, addItem, removeItem, editItem}: ChecklistDetailsProps): React.ReactElement<ChecklistDetailsProps> => {
    const [newvalue, setNewValue] = useState('');
    const [inputExpanded, setInputExpanded] = useState(false);
    const [editMode, setEditMode] = useState(false);

    return (
        <div
            key={checklist.title}
            className='inner-container'
        >
            <div className='title'>
                {checklist.title}
                {' '}
                <a
                    onClick={() => {
                        setEditMode(!editMode);
                    }}
                >
                    <strong>{editMode ? '(done)' : '(edit)'}</strong>
                </a>
            </div>
            {checklist.items.map((checklistItem: ChecklistItem, index: number) => {
                if (editMode) {
                    return (
                        <ChecklistItemDetailsEdit
                            key={checklistItem.title + index}
                            checklistItem={checklistItem}
                            onEdit={(editedTo: string) => {
                                editItem(index, editedTo);
                            }}
                            onRemove={() => {
                                removeItem(index);
                            }}
                        />
                    );
                }

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
            {inputExpanded &&
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        addItem({
                            title: newvalue,
                            checked: false,
                        });
                        setNewValue('');
                        setInputExpanded(false);
                    }}
                >
                    <input
                        type='text'
                        value={newvalue}
                        className='checklist-input'
                        placeholder={'Enter a new item'}
                        onChange={(e) => setNewValue(e.target.value)}
                    />
                </form>
            }
            {!inputExpanded &&
            <div>
                <a
                    onClick={() => {
                        setInputExpanded(true);
                    }}
                ><strong>{'+ Add new checklist item'}</strong></a>
            </div>
            }
        </div>
    );
};

