// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useEffect} from 'react';
import moment from 'moment';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {useRouteMatch} from 'react-router-dom';

import Spinner from 'src/components/assets/icons/spinner';

import {fetchIncidentWithDetails} from 'src/client';
import {Incident} from 'src/types/incident';
import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import Profile from 'src/components/profile';
import BackIcon from 'src/components/assets/icons/back_icon';
import {OVERLAY_DELAY} from 'src/utils/constants';
import {navigateToUrl} from 'src/utils/utils';

import StatusBadge from '../status_badge';

import ChecklistTimeline from './checklist_timeline';
import ExportLink from './export_link';

import './incident_details.scss';

interface MatchParams {
    incidentId: string
}

interface Props {
    onClose: () => void;
}

const BackstageIncidentDetails: FC<Props> = (props: Props) => {
    const [incident, setIncident] = useState<Incident | null>(null);

    const match = useRouteMatch<MatchParams>();

    const fetchIncident = async (incidentId: string) => {
        setIncident(await fetchIncidentWithDetails(incidentId));
    };

    useEffect(() => {
        fetchIncident(match.params.incidentId);
    }, [match.params.incidentId]);

    if (incident === null) {
        return (
            <div className='BackstageIncidentDetails'>
                <Spinner/>
            </div>
        );

    // Not having the channel name is a proxy for determining if the full details where able to be fetched.
    // This means a fetch failure will also land the user here.
    } else if (!incident.channel_name) {
        return (
            <div className='BackstageIncidentDetails'>
                <div className='details-header'>
                    <div className='title'>
                        <BackIcon
                            className='Backstage__header__back'
                            onClick={props.onClose}
                        />
                    </div>
                </div>
                <div className='no-permission-div'>
                    {'You are not a participant in this incident. Contact the commander to request access.'}
                </div>
            </div>
        );
    }

    const goToChannel = () => {
        navigateToUrl(`/${incident.team_name}/channels/${incident.channel_name}`);
    };

    return (
        <div className='BackstageIncidentDetails'>
            <div className='details-header'>
                <div className='title'>
                    <BackIcon
                        className='Backstage__header__back'
                        onClick={props.onClose}
                    />
                    <TextWithTooltip
                        id='title'
                        className='title-text mr-1'
                        text={`Incident ${incident.name}`}
                        placement='bottom'
                    />

                    <OverlayTrigger
                        placement='bottom'
                        delay={OVERLAY_DELAY}
                        overlay={<Tooltip id='goToChannel'>{'Go to Incident Channel'}</Tooltip>}
                    >
                        <button className='link-icon style--none mr-2'>
                            <i
                                className='icon icon-link-variant'
                                onClick={goToChannel}
                            />
                        </button>
                    </OverlayTrigger>
                    <StatusBadge isActive={incident.is_active}/>
                </div>
                <div className='commander-div'>
                    <span className='label p-0 mr-2'>{'Commander:'}</span>
                    <Profile
                        userId={incident.commander_user_id}
                        classNames={{ProfileButton: true, profile: true}}
                    />
                </div>
            </div>
            <div className='subheader'>
                { /*Summary will be a tab once Post Mortem is included */}
                <div className='summary-tab'>
                    {'Summary'}
                </div>
                <ExportLink incident={incident}/>
            </div>
            <div className='statistics-row'>
                <div className='statistics-row__block'>
                    <div className='title'>
                        {'Duration'}
                    </div>
                    <div className='content'>
                        <i className='icon icon-clock-outline box-icon'/>
                        {duration(incident)}
                    </div>
                    <div className='block-footer text-right'>
                        <span>{timeFrameText(incident)}</span>
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
                            {incident.num_members}
                        </div>
                    </div>
                </OverlayTrigger>
                <div className='statistics-row__block'>
                    <div className='title'>
                        {'Messages'}
                    </div>
                    <div className='content'>
                        <i className='icon icon-send box-icon'/>
                        {incident.total_posts}
                    </div>
                    <div className='block-footer text-right'>
                        <a
                            className='link'
                            onClick={goToChannel}
                        >
                            {'Jump to Channel'}
                            <i className='icon icon-arrow-right'/>
                        </a>
                    </div>
                </div>
            </div>
            <div className='chart-block'>
                <ChecklistTimeline
                    incident={incident}
                />
            </div>
        </div>
    );
};

const duration = (incident: Incident) => {
    if (!incident.is_active && moment.unix(incident.ended_at).isSameOrBefore('2020-01-01')) {
        // No end datetime available to calculate duration
        return '--';
    }

    const endTime = incident.is_active ? moment() : moment.unix(incident.ended_at);

    const timeSinceCreation = moment.duration(endTime.diff(moment.unix(incident.created_at)));

    if (timeSinceCreation.days()) {
        return `${timeSinceCreation.days()} days ${timeSinceCreation.hours()} h`;
    }

    if (timeSinceCreation.hours()) {
        return `${timeSinceCreation.hours()} h ${timeSinceCreation.minutes()} m`;
    }

    if (timeSinceCreation.minutes()) {
        return `${timeSinceCreation.minutes()} m`;
    }

    return `${timeSinceCreation.seconds()} s`;
};

const timeFrameText = (incident: Incident) => {
    const mom = moment.unix(incident.ended_at);

    let endedText = 'Ongoing';

    if (!incident.is_active) {
        endedText = mom.isSameOrAfter('2020-01-01') ? mom.format('DD MMM h:mmA') : '--';
    }

    const startedText = moment.unix(incident.created_at).format('DD MMM h:mmA');

    return (`${startedText} - ${endedText}`);
};

export default BackstageIncidentDetails;
