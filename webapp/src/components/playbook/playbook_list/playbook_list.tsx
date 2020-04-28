// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {newPlaybook, Playbook} from 'src/types/playbook';

import {deletePlaybook} from 'src/client';

import PlaybookEdit from '../playbook_edit';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

import '../playbook.scss';

interface Props {
    playbooks: Playbook[];
    fetchPlaybooks: () => void;
}

interface State {
    editMode: boolean;
    selectedPlaybook?: Playbook | null;
    showConfirmation: boolean;
}

export default class PlaybookList extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            editMode: false,
            selectedPlaybook: null,
            showConfirmation: false,
        };
    }

    public componentDidMount(): void {
        this.props.fetchPlaybooks();
    }

    public toggleEditMode = () => {
        this.setState({editMode: !this.state.editMode});
    }

    public editPlaybook = (playbook?: Playbook) => {
        this.setState({
            editMode: true,
            selectedPlaybook: playbook || newPlaybook(),
        });
    }

    public hideConfirmModal = () => {
        this.setState({
            showConfirmation: false,
            selectedPlaybook: null,
        });
    }

    public onConfirmDelete = (playbook: Playbook) => {
        this.setState({
            showConfirmation: true,
            selectedPlaybook: playbook,
        });
    }

    public onDelete = async () => {
        if (this.state.selectedPlaybook) {
            await deletePlaybook(this.state.selectedPlaybook);
            this.hideConfirmModal();
        }
    }

    public render(): JSX.Element {
        return (
            <>
                {
                    !this.state.editMode && (
                        <div className='Playbook'>
                            <div className='header'>
                                <div className='title'>
                                    {'Playbooks'}
                                </div>
                                <div className='header-button-div'>
                                    <button
                                        className='btn btn-primary'
                                        onClick={() => this.editPlaybook()}
                                    >
                                        <i className='icon icon-plus mr-1'/>
                                        {'New Playbook'}
                                    </button>
                                </div>
                            </div>
                            <div className='playbook-list'>
                                {
                                    <div className='list-header'>
                                        <div className='row'>
                                            <div className='col-sm-10'> {'Name'} </div>
                                            <div className='col-sm-2'> {'Actions'}</div>
                                        </div>
                                    </div>
                                }
                                {
                                    !this.props.playbooks.length &&
                                    <div className='text-center pt-8'>
                                        {'There are no playbooks defined yet.'}
                                    </div>
                                }

                                {
                                    this.props.playbooks.map((p) => (
                                        <div
                                            className='row playbook-item'
                                            key={p.id}
                                        >
                                            <div className='col-sm-10'> {p.title} </div>
                                            <div className='col-sm-2'>
                                                <a onClick={() => this.editPlaybook(p)} >
                                                    {'Edit'}
                                                </a>
                                                {' - '}
                                                <a onClick={() => this.onConfirmDelete(p)} >
                                                    {'Delete'}
                                                </a>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                            <ConfirmModal
                                show={this.state.showConfirmation}
                                title={'Confirm Playbook Deletion'}
                                message={`Are you sure you want to delete the playbook "${this.state.selectedPlaybook?.title}"?`}
                                confirmButtonText={'Delete Playbook'}
                                onConfirm={this.onDelete}
                                onCancel={this.hideConfirmModal}
                            />
                        </div>
                    )}
                {
                    this.state.editMode && (
                        <PlaybookEdit
                            playbook={this.state.selectedPlaybook}
                            onClose={this.toggleEditMode}
                        />
                    )
                }
            </>
        );
    }
}
