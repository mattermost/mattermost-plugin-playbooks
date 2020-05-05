// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Playbook, Checklist, ChecklistItem} from 'src/types/playbook';
import {savePlaybook} from 'src/client';

import {ChecklistDetails} from 'src/components/checklist/checklist';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

import BackIcon from './back_icon';

import './playbook.scss';

interface Props {
    playbook: Playbook;
    currentTeamID: string;
    onClose: () => void;
}

interface State{
    title: string;
    checklists: Checklist[];
    newPlaybook: boolean;
    changesMade: boolean;
    confirmOpen: boolean;
}

export default class PlaybookEdit extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            title: this.props.playbook?.title,
            checklists: JSON.parse(JSON.stringify(this.props.playbook.checklists)),
            newPlaybook: !this.props.playbook.id,
            changesMade: false,
            confirmOpen: false,
        };
    }

    public onSave = async () => {
        const newPlaybook: Playbook = {
            id: this.props.playbook.id,
            title: this.state.title,
            team_id: this.props.currentTeamID,
            checklists: this.state.checklists,
        };

        await savePlaybook(newPlaybook);

        this.props.onClose();
    };

    public updateChecklist(newChecklist: Checklist[]) {
        this.setState({
            checklists: newChecklist,
            changesMade: true,
        });
    }

    public onAddItem = (checklistItem: ChecklistItem, checklistIndex: number): void => {
        const allChecklists = Object.assign([], this.state.checklists) as Checklist[];
        const changedChecklist = Object.assign({}, this.state.checklists[checklistIndex]);

        changedChecklist.items = [...changedChecklist.items, checklistItem];
        allChecklists[checklistIndex] = changedChecklist;

        this.updateChecklist(allChecklists);
    }

    public onDeleteItem = (checklistItemIndex: number, checklistIndex: number): void => {
        const allChecklists = Object.assign([], this.state.checklists) as Checklist[];
        const changedChecklist = Object.assign({}, allChecklists[checklistIndex]) as Checklist;

        changedChecklist.items = [
            ...changedChecklist.items.slice(0, checklistItemIndex),
            ...changedChecklist.items.slice(checklistItemIndex + 1, changedChecklist.items.length)];
        allChecklists[checklistIndex] = changedChecklist;

        this.updateChecklist(allChecklists);
    }

    public onEditItem = (checklistItemIndex: number, newTitle: string, checklistIndex: number): void => {
        const allChecklists = Object.assign([], this.state.checklists) as Checklist[];
        const changedChecklist = Object.assign({}, allChecklists[checklistIndex]) as Checklist;

        changedChecklist.items[checklistItemIndex].title = newTitle;
        allChecklists[checklistIndex] = changedChecklist;

        this.updateChecklist(allChecklists);
    }

    public onReorderItem = (checklistItemIndex: number, newIndex: number, checklistIndex: number): void => {
        const allChecklists = Object.assign([], this.state.checklists) as Checklist[];
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

        this.updateChecklist(allChecklists);
    }

    public handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({
            title: e.target.value,
            changesMade: true,
        });
    }

    public confirmOrClose = () => {
        if (this.state.changesMade) {
            this.setState({
                confirmOpen: true,
            });
        } else {
            this.props.onClose();
        }
    }

    public confirmCancel = () => {
        this.setState({
            confirmOpen: false,
        });
    }

    public render(): JSX.Element {
        const title = this.state.newPlaybook ? 'New Playbook' : 'Edit Playbook';
        const saveDisabled = this.state.newPlaybook ? this.state.title === '' : !this.state.changesMade;

        return (
            <div className='Playbook'>
                <div className='header'>
                    <div className='title'>
                        <BackIcon
                            className='back-icon mr-4'
                            onClick={this.confirmOrClose}
                        />
                        {title}
                    </div>
                    <div className='header-button-div'>
                        <button
                            className='btn btn-link mr-2'
                            onClick={this.confirmOrClose}
                        >
                            {'Cancel'}
                        </button>
                        <button
                            className='btn btn-primary'
                            disabled={saveDisabled}
                            onClick={this.onSave}
                        >
                            {'Save Playbook'}
                        </button>
                    </div>
                </div>
                <div className='playbook-fields'>
                    <input
                        id={'playbook-name'}
                        className='form-control input-name'
                        type='text'
                        placeholder='Playbook Name'
                        value={this.state.title}
                        onChange={this.handleTitleChange}
                    />
                    <div className='cheklist-container'>
                        <div className='checkbox-container'>
                            {this.state.checklists?.map((checklist: Checklist, checklistIndex: number) => (
                                <ChecklistDetails
                                    checklist={checklist}
                                    enableEdit={true}
                                    key={checklist.title + checklistIndex}

                                    addItem={(checklistItem: ChecklistItem) => {
                                        this.onAddItem(checklistItem, checklistIndex);
                                    }}
                                    removeItem={(chceklistItemIndex: number) => {
                                        this.onDeleteItem(chceklistItemIndex, checklistIndex);
                                    }}
                                    editItem={(checklistItemIndex: number, newTitle: string) => {
                                        this.onEditItem(checklistItemIndex, newTitle, checklistIndex);
                                    }}
                                    reorderItems={(checklistItemIndex: number, newPosition: number) => {
                                        this.onReorderItem(checklistItemIndex, newPosition, checklistIndex);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <ConfirmModal
                    show={this.state.confirmOpen}
                    title={'Confirm discard'}
                    message={'Are you sure you want to discard your changes?'}
                    confirmButtonText={'Discard Changes'}
                    onConfirm={this.props.onClose}
                    onCancel={this.confirmCancel}
                />
            </div>
        );
    }
}
