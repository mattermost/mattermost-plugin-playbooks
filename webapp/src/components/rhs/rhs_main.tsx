// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Scrollbars from 'react-custom-scrollbars';

import {Incident} from 'src/types/incident';
import {RHSState} from 'src/types/rhs';

import RHSHeader from 'src/components/rhs_header';

import IncidentList from './incident_list';

import IncidentDetails from './incident_details';

import './rhs.scss';

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

    public render(): JSX.Element {
        return (
            <div className='RightHandSidebar'>
                <RHSHeader/>
                {this.props.isLoading && !this.props.incident.name &&
                    <div className='loading-container'>
                        <i className='fa fa-spin fa-spinner mr-2'/>
                        <span>{'Loading...'}</span>
                    </div>
                }
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbHorizontal={renderThumbHorizontal}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                >
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
            </div>
        );
    }
}
