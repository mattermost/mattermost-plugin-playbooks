// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FullScreenModal from 'src/components/full_screen_modal/full_screen_modal';

import {Playbook} from 'src/types/incident';

import {createPlaybook} from 'src/client';

interface Props {
    visible: boolean;
    close: () => object;
    playbook: Playbook;
}

export default class ConfigurePlaybookModal extends React.PureComponent<Props> {
    constructor(props: Props) {
        super(props);

        console.log('Original PLAYBOOK: ');
        console.log(this.props.playbook);

        this.state = {
            title: this.props.playbook.title,
        };
    }

    public onClose = (): void => {
        this.props.close();
    };

    public onSave = (): void => {
        console.log('SAVING PLAYBOOK: ');

        const newPlaybook: Playbook = {
            title: this.state.title,
        };

        console.log(newPlaybook);

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

                    //  disabled={!this.props.allowEndIncident}
                    >
                        {'Save Playbook'}
                    </button>

                </div>
            </FullScreenModal>
        );
    }
}
