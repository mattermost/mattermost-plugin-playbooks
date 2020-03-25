// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Scrollbars from 'react-custom-scrollbars';

import {Incident, RHSState} from 'src/types/incident';

import IncidentItem from './incident_item';
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
    actions: {
        getIncidents: () => void;
        getIncidentDetails: (id: string) => void;
        setRHSState: (state: RHSState) => void;
    };
}

export default class RightHandSidebar extends React.PureComponent<Props> {
    public componentDidMount(): void {
        this.props.actions.getIncidents();
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
                        this.props.rhsState !== RHSState.List &&
                        <div className='navigation-bar'>
                            <i
                                className='fa fa-chevron-left'
                                onClick={this.goBack}
                            />
                            <div className='title'>{this.props.incident.name}</div>
                        </div>
                    }
                    <div>
                        {
                            this.props.rhsState === RHSState.List &&
                            this.props.incidents.map((i) => (
                                <IncidentItem
                                    key={i.id}
                                    incident={i}
                                    onClick={() => this.handleClick(i.id)}
                                />
                            ))
                        }
                        {
                            this.props.rhsState === RHSState.Details &&
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
