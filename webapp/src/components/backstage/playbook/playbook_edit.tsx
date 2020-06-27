// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useEffect} from 'react';

import Toggle from 'src/components/widgets/toggle';

import {Playbook, Checklist, ChecklistItem, emptyPlaybook} from 'src/types/playbook';
import {savePlaybook, clientFetchPlaybook} from 'src/client';
import {ChecklistDetails} from 'src/components/checklist';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {MAX_NAME_LENGTH} from 'src/constants';

import BackIcon from 'src/components/assets/icons/back_icon';

import './playbook.scss';

interface Props {
    playbookId?: string;
    newPlaybook: boolean;
    currentTeamID: string;
    onClose: () => void;
}

const PlaybookEdit: FC<Props> = (props: Props) => {
    const [playbook, setPlaybook] = useState<Playbook>({
        ...emptyPlaybook(),
        team_id: props.currentTeamID,
    });
    const [changesMade, setChangesMade] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (props.playbookId) {
                setPlaybook(await clientFetchPlaybook(props.playbookId));
            }
        };
        fetchData();
    }, []);

    const onSave = async () => {
        await savePlaybook(playbook);
        props.onClose();
    };

    const updateChecklist = (newChecklist: Checklist[]) => {
        setPlaybook({
            ...playbook,
            checklists: newChecklist,
        });
        setChangesMade(true);
    };

    const onAddItem = (checklistItem: ChecklistItem, checklistIndex: number): void => {
        const allChecklists = Object.assign([], playbook.checklists) as Checklist[];
        const changedChecklist = Object.assign({}, playbook.checklists[checklistIndex]);

        changedChecklist.items = [...changedChecklist.items, checklistItem];
        allChecklists[checklistIndex] = changedChecklist;

        updateChecklist(allChecklists);
    };

    const onDeleteItem = (checklistItemIndex: number, checklistIndex: number): void => {
        const allChecklists = Object.assign([], playbook.checklists) as Checklist[];
        const changedChecklist = Object.assign({}, allChecklists[checklistIndex]) as Checklist;

        changedChecklist.items = [
            ...changedChecklist.items.slice(0, checklistItemIndex),
            ...changedChecklist.items.slice(checklistItemIndex + 1, changedChecklist.items.length)];
        allChecklists[checklistIndex] = changedChecklist;

        updateChecklist(allChecklists);
    };

    const onEditItem = (checklistItemIndex: number, newTitle: string, checklistIndex: number): void => {
        const allChecklists = Object.assign([], playbook.checklists) as Checklist[];
        const changedChecklist = Object.assign({}, allChecklists[checklistIndex]) as Checklist;

        changedChecklist.items[checklistItemIndex].title = newTitle;
        allChecklists[checklistIndex] = changedChecklist;

        updateChecklist(allChecklists);
    };

    const onReorderItem = (checklistItemIndex: number, newIndex: number, checklistIndex: number): void => {
        const allChecklists = Object.assign([], playbook.checklists) as Checklist[];
        const changedChecklist = Object.assign({}, allChecklists[checklistIndex]) as Checklist;

        const itemToMove = changedChecklist.items[checklistItemIndex];

        // Remove from current index
        changedChecklist.items = [
            ...changedChecklist.items.slice(0, checklistItemIndex),
            ...changedChecklist.items.slice(checklistItemIndex + 1, changedChecklist.items.length)];

        // Add in new index
        changedChecklist.items = [
            ...changedChecklist.items.slice(0, newIndex),
            itemToMove,
            ...changedChecklist.items.slice(newIndex, changedChecklist.items.length + 1)];

        allChecklists[checklistIndex] = changedChecklist;

        updateChecklist(allChecklists);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPlaybook({
            ...playbook,
            title: e.target.value,
        });
        setChangesMade(true);
    };

    const confirmOrClose = () => {
        if (changesMade) {
            setConfirmOpen(true);
        } else {
            props.onClose();
        }
    };

    const confirmCancel = () => {
        setConfirmOpen(false);
    };

    const handlePublicChange = () => {
        setPlaybook({
            ...playbook,
            create_public_incident: !playbook.create_public_incident,
        });
        setChangesMade(true);
    };

    const saveDisabled = playbook.title.trim() === '' || !changesMade;

    const notFoundComponent = (
        <div className='Playbook'>
            <div className='Backstage__header'>
                <div className='title'>
                    <BackIcon
                        className='Backstage__header__back'
                        onClick={confirmOrClose}
                    />
                    {'Playbook Not Found'}
                </div>
            </div>
        </div>
    );

    const editComponent = (
        <div className='Playbook'>
            <div className='Backstage__header'>
                <div className='title'>
                    <BackIcon
                        className='Backstage__header__back'
                        onClick={confirmOrClose}
                    />
                    {props.newPlaybook ? 'New Playbook' : 'Edit Playbook'}
                </div>
                <div className='header-button-div'>
                    <button
                        className='btn btn-link mr-2'
                        onClick={confirmOrClose}
                    >
                        {'Cancel'}
                    </button>
                    <button
                        className='btn btn-primary'
                        disabled={saveDisabled}
                        onClick={onSave}
                    >
                        {'Save Playbook'}
                    </button>
                </div>
            </div>
            <div className='playbook-fields'>
                <input
                    autoFocus={true}
                    id={'playbook-name'}
                    className='form-control input-name'
                    type='text'
                    placeholder='Playbook Name'
                    value={playbook.title}
                    maxLength={MAX_NAME_LENGTH}
                    onChange={handleTitleChange}
                />
                <div className='public-item'>
                    <div
                        className='checkbox-container'
                    >
                        <Toggle
                            toggled={playbook.create_public_incident}
                            onToggle={handlePublicChange}
                        />
                        <label>
                            {'Create Public Incident'}
                        </label>
                    </div>
                </div>
                <div className='checklist-container'>
                    {playbook.checklists?.map((checklist: Checklist, checklistIndex: number) => (
                        <ChecklistDetails
                            checklist={checklist}
                            enableEdit={true}
                            key={checklist.title + checklistIndex}
                            addItem={(checklistItem: ChecklistItem) => {
                                onAddItem(checklistItem, checklistIndex);
                            }}
                            removeItem={(chceklistItemIndex: number) => {
                                onDeleteItem(chceklistItemIndex, checklistIndex);
                            }}
                            editItem={(checklistItemIndex: number, newTitle: string) => {
                                onEditItem(checklistItemIndex, newTitle, checklistIndex);
                            }}
                            reorderItems={(checklistItemIndex: number, newPosition: number) => {
                                onReorderItem(checklistItemIndex, newPosition, checklistIndex);
                            }}
                        />
                    ))}
                </div>
            </div>
            <ConfirmModal
                show={confirmOpen}
                title={'Confirm discard'}
                message={'Are you sure you want to discard your changes?'}
                confirmButtonText={'Discard Changes'}
                onConfirm={props.onClose}
                onCancel={confirmCancel}
            />
        </div>
    );

    const isPlaybookDefined = props.newPlaybook || playbook.id;

    return isPlaybookDefined ? editComponent : notFoundComponent;
};

export default PlaybookEdit;
