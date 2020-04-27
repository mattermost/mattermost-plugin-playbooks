// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Scrollbars from 'react-custom-scrollbars';

import {Incident, RHSState} from 'src/types/incident';
import {BackstageArea} from 'src/types/backstage';

import IncidentList from './incident_list';

import IncidentDetails from './incident_details';

import './rhs.scss';
import PlaybookIcon from './playbook_icon';

export function renderView(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--view'
        />);
}

export function renderThumbHorizontal(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--horizontal'
        />);
}

export function renderThumbVertical(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--vertical'
        />);
}

interface Props {
    incidents: Incident[];
    incident: Incident;
    rhsState: RHSState;
    isLoading: boolean;
    actions: {
        startIncident: () => void;
        getIncidentsForCurrentTeam: () => void;
        getIncidentDetails: (id: string) => void;
        setRHSState: (state: RHSState) => void;
        setRHSOpen: (open: boolean) => void;
        openBackstageModal: (selectedArea: BackstageArea) => void;
    };
}

export default class RightHandSidebar extends React.PureComponent<Props> {
    public componentDidMount(): void {
        this.props.actions.getIncidentsForCurrentTeam();
        this.props.actions.setRHSOpen(true);
    }

    public componentWillUnmount(): void {
        this.props.actions.setRHSOpen(false);
    }

    public handleClick = (id: string) => {
        this.props.actions.getIncidentDetails(id);
        this.props.actions.setRHSState(RHSState.Details);
    }

    public goBack = () => {
        this.props.actions.setRHSState(RHSState.List);
    }

    public render(): JSX.Element {
        return (
            <React.Fragment>
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbHorizontal={renderThumbHorizontal}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    className='RightHandSidebar'
                >
                    {
                        this.props.isLoading && !this.props.incident.name &&
                        <React.Fragment>
                            <div className='navigation-bar'>
                                <div className='incident-details'>
                                    <div className='title'>{'Incident List'}</div>
                                </div>
                            </div>
                            <div className='loading-container'>
                                <i className='fa fa-spin fa-spinner mr-2'/>
                                <span>{'Loading...'}</span>
                            </div>
                        </React.Fragment>
                    }
                    {
                        this.props.rhsState === RHSState.List && !this.props.isLoading &&
                        <div className='navigation-bar'>
                            <div>
                                <div className='title'>{'Incident List'}</div>
                            </div>
                            <div className='d-flex align-items-center'>
                                <button
                                    className='navigation-bar__button'
                                    onClick={() => this.props.actions.openBackstageModal(BackstageArea.Playbooks)}
                                >
                                    <PlaybookIcon/>
                                </button>
                                <button
                                    className='navigation-bar__button'
                                    onClick={() => this.props.actions.startIncident()}
                                >
                                    <i
                                        className='icon icon-plus'
                                    />
                                </button>
                            </div>
                        </div>
                    }
                    {
                        this.props.rhsState !== RHSState.List && !this.props.isLoading &&
                        <div className='navigation-bar'>
                            <div className='incident-details'>
                                <i
                                    className='fa fa-angle-left'
                                    onClick={this.goBack}
                                />
                                <div className='title'>{this.props.incident.name}</div>
                            </div>
                        </div>
                    }
                    <div>
                        {
                            this.props.rhsState === RHSState.List && !this.props.isLoading &&
                            <IncidentList
                                incidents={this.props.incidents}
                                onClick={this.handleClick}
                            />
                        }
                        {
                            this.props.rhsState === RHSState.Details && !this.props.isLoading &&
                            <IncidentDetails
                                incident={this.props.incident}
                            />
                        }
                    </div>
                </Scrollbars>
            </React.Fragment>
        );
    }
}
