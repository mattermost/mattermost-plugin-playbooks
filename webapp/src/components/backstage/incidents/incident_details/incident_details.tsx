// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import moment from 'moment';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {exportChannelUrl} from 'src/client';

import {Incident} from 'src/types/incident';

import Profile from 'src/components/profile';
import BackIcon from 'src/components/assets/icons/back_icon';

import StatusBadge from '../status_badge';

import ChecklistTimeline from './checklist_timeline';

import './incident_details.scss';

const OVERLAY_DELAY = 400;

interface Props {
    incident: Incident;
    involvedInIncident: boolean;
    exportAvailable: boolean;
    exportLicensed: boolean;
    theme: Record<string, string>;
    onClose: () => void;
    actions: {
        navigateToUrl: (urlPath: string) => void;
    };
}

interface State {
    showBanner: boolean;
}

export default class BackstageIncidentDetails extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            showBanner: false,
        };
    }
    public timeFrameText = () => {
        const mom = moment.unix(this.props.incident.ended_at);

        let endedText = 'Ongoing';

        if (!this.props.incident.is_active) {
            endedText = mom.isSameOrAfter('2020-01-01') ? mom.format('DD MMM h:mmA') : '--';
        }

        const startedText = moment.unix(this.props.incident.created_at).format('DD MMM h:mmA');

        return (`${startedText} - ${endedText}`);
    }

    public duration = () => {
        if (!this.props.incident.is_active && moment.unix(this.props.incident.ended_at).isSameOrBefore('2020-01-01')) {
            // No end datetime available to calculate duration
            return '--';
        }

        const endTime = this.props.incident.is_active ? moment() : moment.unix(this.props.incident.ended_at);

        const duration = moment.duration(endTime.diff(moment.unix(this.props.incident.created_at)));

        if (duration.days()) {
            return `${duration.days()} days ${duration.hours()} h`;
        }

        if (duration.hours()) {
            return `${duration.hours()} h ${duration.minutes()} m`;
        }

        if (duration.minutes()) {
            return `${duration.minutes()} m`;
        }

        return `${duration.seconds()} s`;
    }

    public goToChannel = () => {
        this.props.actions.navigateToUrl(`/${this.props.incident.main_channel_info?.team_name}/channels/${this.props.incident.main_channel_info?.channel_name}`);
    }

    public onExportClick =() => {
        this.setState({showBanner: true}, () => {
            window.setTimeout(() => {
                this.setState({showBanner: false});
            }, 2500);
        });
    }

    public exportLink = () => {
        const linkText = (
            <>
                <i className='icon icon-download-outline export-icon'/>
                {'Export Incident Channel'}
            </>
        );

        let tooltipText = '';
        if (!this.props.exportAvailable) {
            tooltipText = 'Install and enable the Channel Export plugin to support exporting this incident';
        } else if (!this.props.exportLicensed) {
            tooltipText = 'Exporting an incident channel requires a Mattermost Enterprise E20 license';
        }

        if (!this.props.exportAvailable || !this.props.exportLicensed) {
            return (
                <OverlayTrigger
                    placement='bottom'
                    delay={OVERLAY_DELAY}
                    overlay={<Tooltip id='exportUnavailable'>{tooltipText}</Tooltip>}
                >
                    <div className={'disabled'}>
                        {linkText}
                    </div>
                </OverlayTrigger>
            );
        }

        const mainChannelId = this.props.incident.channel_ids[0];

        return (
            <a
                className={'export-link'}
                href={exportChannelUrl(mainChannelId)}
                target={'_new'}
                onClick={this.onExportClick}
            >
                {linkText}
            </a>
        );
    }

    public render(): JSX.Element {
        const detailsHeader = (
            <div className='details-header'>
                <div className='title'>
                    <BackIcon
                        className='Backstage__header__back'
                        onClick={this.props.onClose}
                    />
                    <span className='mr-1'>{`Incident ${this.props.incident.name}`}</span>

                    { this.props.involvedInIncident &&
                    <OverlayTrigger
                        placement='bottom'
                        delay={OVERLAY_DELAY}
                        overlay={<Tooltip id='goToChannel'>{'Go to Incident Channel'}</Tooltip>}
                    >
                        <button className='link-icon style--none mr-2'>
                            <i
                                className='icon icon-link-variant'
                                onClick={this.goToChannel}
                            />
                        </button>
                    </OverlayTrigger>
                    }
                    <StatusBadge isActive={this.props.incident.is_active}/>
                </div>
                <div className='commander-div'>
                    <span className='label p-0 mr-2'>{'Commander:'}</span>
                    <Profile
                        userId={this.props.incident.commander_user_id}
                        classNames={{ProfileButton: true, profile: true}}
                    />
                </div>
            </div>);

        const downloadStartedBanner = this.state.showBanner && (
            <div className='banner'>
                <div className='banner__text'>
                    <i className='icon icon-download-outline mr-1'/>
                    {'Downloading incident channel export'}
                </div>
            </div>
        );

        if (!this.props.involvedInIncident) {
            return (
                <div className='BackstageIncidentDetails'>
                    {detailsHeader}
                    <div className='no-permission-div'>
                        {'You are not a participant in this incident. Contact the commander to request access.'}
                    </div>
                </div>
            );
        }

        return (
            <div className='BackstageIncidentDetails'>
                {downloadStartedBanner}
                {detailsHeader}
                <div className='subheader'>
                    { /*Summary will be a tab once Post Mortem is included */}
                    <div className='summary-tab'>
                        {'Summary'}
                    </div>
                    {this.exportLink()}
                </div>
                <div className='statistics-row'>
                    <div className='statistics-row__block'>
                        <div className='title'>
                            {'Duration'}
                        </div>
                        <div className='content'>
                            <i className='icon icon-clock-outline box-icon'/>
                            {this.duration()}
                        </div>
                        <div className='block-footer text-right'>
                            <span>{this.timeFrameText()}</span>
                        </div>
                    </div>
                    <OverlayTrigger
                        placement='bottom'
                        delay={OVERLAY_DELAY}
                        overlay={<Tooltip id='goToChannel'>{'Number of users currently in the incident channel'}</Tooltip>}
                    >
                        <div className='statistics-row__block'>
                            <div className='title'>
                                {'Members Involved'}
                            </div>
                            <div className='content'>
                                <i className='icon icon-account-multiple-outline box-icon'/>
                                {this.props.incident.main_channel_info?.num_participants}
                            </div>
                        </div>
                    </OverlayTrigger>
                    <div className='statistics-row__block'>
                        <div className='title'>
                            {'Messages'}
                        </div>
                        <div className='content'>
                            <i className='icon icon-send box-icon'/>
                            {this.props.incident.main_channel_info?.total_posts}
                        </div>
                        <div className='block-footer text-right'>
                            <a
                                className='link'
                                onClick={this.goToChannel}
                            >
                                {'Jump to Channel'}
                                <i className='icon icon-arrow-right'/>
                            </a>
                        </div>
                    </div>
                </div>
                <div className='chart-block'>
                    <ChecklistTimeline
                        width={740}
                        height={225}
                        incident={this.props.incident}
                        theme={this.props.theme}
                    />
                </div>
            </div>
        );
    }
}
