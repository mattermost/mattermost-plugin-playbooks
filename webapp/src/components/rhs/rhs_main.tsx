// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Scrollbars from 'react-custom-scrollbars';

import Spinner from 'src/components/spinner';
import {Incident} from 'src/types/incident';
import {RHSState} from 'src/types/rhs';
import LegacyRHSHeader from 'src/components/rhs/legacy_rhs_header';

import IncidentList from './incident_list';
import RHSIncidentDetails from './incident_details';

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
    addLegacyHeader: boolean;
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
            <div className='incident-rhs'>
                { this.props.addLegacyHeader && <LegacyRHSHeader/> }
                <div className='incident-rhs__content'>
                    {
                        this.props.isLoading &&
                        <div className='spinner-container'>
                            <Spinner/>
                            <span>{'Loading...'}</span>
                        </div>
                    }
                    <div>
                        {
                            this.props.rhsState === RHSState.List && !this.props.isLoading &&
                            <Scrollbars
                                autoHide={true}
                                autoHideTimeout={500}
                                autoHideDuration={500}
                                renderThumbHorizontal={renderThumbHorizontal}
                                renderThumbVertical={renderThumbVertical}
                                renderView={renderView}
                                style={{position: 'absolute'}}
                            >
                                <IncidentList
                                    incidents={this.props.incidents}
                                    onClick={this.handleClick}
                                />
                            </Scrollbars>
                        }
                        {
                            this.props.rhsState === RHSState.Details && !this.props.isLoading &&
                            <RHSIncidentDetails
                                incident={this.props.incident}
                            />
                        }
                    </div>
                </div>
            </div>
        );
    }
}
