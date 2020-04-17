// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FullScreenModal from 'src/components/full_screen_modal/full_screen_modal';

import {Playbook} from 'src/types/incident';

import {createPlaybook} from 'src/client';

interface Props {
    visible: boolean;
    close: () => object;
    fetchPlaybooks: () => void;
    playbook: Playbook;
}

export default class ConfigurePlaybookModal extends React.PureComponent<Props> {
    constructor(props: Props) {
        super(props);

        this.state = {
            title: this.props.playbook?.title,
        };
    }

    public componentDidUpdate(prevProps: Props) {
        if (this.props.playbook !== prevProps.playbook) {
            this.setState({title: this.props.playbook.title});
        }
    }

    public componentDidMount(): void {
        if (!this.props.playbook) {
            this.props.fetchPlaybooks();
        }
    }

    public onClose = (): void => {
        this.props.close();
    };

    public onSave = (): void => {
        const newPlaybook: Playbook = {
            title: this.state.title,
        };

        createPlaybook(newPlaybook);
    };

    public handleTitleChange = (e) => {
        this.setState({title: e.target.value});
    }

    public render(): JSX.Element {
        return (
            <FullScreenModal
                show={this.props.visible}
                onClose={this.onClose}
            >
                <div>
                    <input
                        id={'playbook-name'}
                        className='form-control'
                        type='text'
                        placeholder='Attribute Label'
                        value={this.state.title}

                        onChange={this.handleTitleChange}
                    />
                </div>
                <div>
                    <button
                        className='btn btn-primary'
                        onClick={this.onSave}
                    >
                        {'Save'}
                    </button>
                    <button
                        className='btn'
                        onClick={this.props.close}
                    >
                        {'Cancel'}
                    </button>
                </div>
            </FullScreenModal>
        );
    }
}
