// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {debounce} from 'debounce';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {isMobile} from 'src/utils/utils';
import {BackstageArea} from 'src/types/backstage';

import PlaybookIcon from 'src/components/assets/icons/playbook_icon';
import PlusIcon from 'src/components/assets/icons/plus_icon';

import './rhs_header.scss';

interface Props {
    actions: {
        startIncident: () => void;
        openBackstageModal: (selectedArea: BackstageArea) => void;
    };
}

const OVERLAY_DELAY = 400;

export default function RHSHeader(props: Props) {
    const [width, setWidth] = React.useState(0);

    useEffect(() => {
        let resizeListener = () => {
            if (width !== window.innerWidth) {
                setWidth(window.innerWidth);
            }
        };
        resizeListener = debounce(resizeListener, 300);
        resizeListener();

        window.addEventListener('resize', resizeListener);

        // clean up function
        return () => {
            window.removeEventListener('resize', resizeListener);
        };
    });

    return (
        <div className='rhs-header-bar'>
            <React.Fragment>
                <div>
                    {/* filter dropdown placeholder */}
                </div>

                <div className={'header-buttons'}>
                    {
                        !isMobile() &&
                        <OverlayTrigger
                            placement='bottom'
                            delayShow={OVERLAY_DELAY}
                            overlay={<Tooltip id='playbooksTooltip'>{'Playbooks'}</Tooltip>}
                        >
                            <button
                                className='rhs-header-bar__button'
                                onClick={() => props.actions.openBackstageModal(BackstageArea.Playbooks)}
                            >
                                <PlaybookIcon/>
                            </button>
                        </OverlayTrigger>
                    }
                    <OverlayTrigger
                        placement='bottom'
                        delayShow={OVERLAY_DELAY}
                        overlay={<Tooltip id='startIncidentTooltip'>{'Start New Incident'}</Tooltip>}
                    >
                        <button
                            className='rhs-header-bar__button'
                            onClick={() => props.actions.startIncident()}
                        >
                            <PlusIcon/>
                        </button>
                    </OverlayTrigger>
                </div>
            </React.Fragment>
        </div>
    );
}
