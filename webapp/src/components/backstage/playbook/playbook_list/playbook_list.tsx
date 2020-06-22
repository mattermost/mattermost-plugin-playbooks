// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Switch, Route, RouteComponentProps} from 'react-router-dom';

import {Team} from 'mattermost-redux/types/teams';

import {newPlaybook, Playbook} from 'src/types/playbook';
import {navigateToTeamPluginUrl} from 'src/utils/utils';

import {deletePlaybook} from 'src/client';

import PlaybookEdit from 'src/components/backstage/playbook/playbook_edit';
import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

import '../playbook.scss';

interface Props extends RouteComponentProps {
    playbooks: Playbook[];
    currentTeam: Team;
    actions: {
        getPlaybooksForCurrentTeam: () => void;
    };
}

interface State {
    newMode: boolean;
    selectedPlaybook?: Playbook | null;
    showConfirmation: boolean;
    showBanner: boolean;
}

export default class PlaybookList extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            newMode: false,
            selectedPlaybook: null,
            showConfirmation: false,
            showBanner: false,
        };
    }

    public componentDidMount(): void {
        this.props.actions.getPlaybooksForCurrentTeam();
    }

    public backToPlaybookList = () => {
        this.setState({
            newMode: false,
        });
        navigateToTeamPluginUrl(this.props.currentTeam.name, '/playbooks');
    }

    public editPlaybook = (playbook: Playbook) => {
        this.setState({
            newMode: false,
            selectedPlaybook: playbook,
        });
        navigateToTeamPluginUrl(this.props.currentTeam.name, `/playbooks/${playbook.id}`);
    }

    public newPlaybook = () => {
        this.setState({
            newMode: true,
        });
    }

    public hideConfirmModal = () => {
        this.setState({
            showConfirmation: false,
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

            this.setState({showBanner: true}, () => {
                window.setTimeout(() => {
                    this.setState({showBanner: false});
                }, 5000);
            });
        }
    }

    public render(): JSX.Element {
        const deleteSuccessfulBanner = this.state.showBanner && (
            <div className='banner'>
                <div className='banner__text'>
                    <i className='icon icon-check mr-1'/>
                    {`The playbook ${this.state.selectedPlaybook?.title} was successfully deleted.`}
                </div>
            </div>
        );

        const editComponent = (isNewPlaybook: boolean) => {
            return (
                <PlaybookEdit
                    newPlaybook={isNewPlaybook}
                    currentTeamID={this.props.currentTeam.id}
                    onClose={this.backToPlaybookList}
                />
            );
        };

        const listComponent = (
            <div className='Playbook'>
                { deleteSuccessfulBanner }
                <div className='Backstage__header'>
                    <div
                        data-testid='titlePlaybook'
                        className='title'
                    >
                        {'Playbooks'}
                        <div className='light'>
                            {'(' + this.props.currentTeam.display_name + ')'}
                        </div>
                    </div>
                    <div className='header-button-div'>
                        <button
                            className='btn btn-primary'
                            onClick={() => this.newPlaybook()}
                        >
                            <i className='icon-plus mr-2'/>
                            {'New Playbook'}
                        </button>
                    </div>
                </div>
                <div className='playbook-list'>
                    {
                        <div className='Backstage-list-header'>
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
                                <a className='col-sm-10 title'>
                                    <TextWithTooltip
                                        id={p.title}
                                        text={p.title}
                                    />
                                </a>
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
        );

        return (
            <Switch>
                <Route
                    exact={true}
                    path={this.props.match.path}
                >
                    {
                        !this.state.newMode && listComponent
                    }
                    {
                        this.state.newMode && editComponent(true)
                    }
                </Route>
                <Route path={`${this.props.match.path}/:playbookId`}>
                    {editComponent(false)}
                </Route>
            </Switch>
        );
    }
}
