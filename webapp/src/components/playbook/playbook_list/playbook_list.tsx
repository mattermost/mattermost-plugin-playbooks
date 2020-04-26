// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PlaybookEdit from '../playbook_edit';
import {newPlaybook, Playbook} from 'src/types/playbook';

import '../playbook.scss';

interface Props {
    playbooks: Playbook[];
    fetchPlaybooks: () => void;
}

interface State {
    editMode: boolean;
    selectedPlaybook?: Playbook | null;
}

export default class PlaybookList extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            editMode: false,
            selectedPlaybook: null,
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
                                        {'+ New Playbook'}
                                    </button>
                                </div>
                            </div>
                            <div className='playbook-list'>
                                {
                                    <div className='list-header row'>
                                        <div className='col-sm-10'> {'Name'} </div>
                                        <div className='col-sm-2'> {'Actions'}</div>
                                    </div>
                                }
                                {
                                    !this.props.playbooks.length &&
                                    <div className='empty-list'>
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
                                                <a>
                                                    {'Delete'}
                                                </a>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
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
