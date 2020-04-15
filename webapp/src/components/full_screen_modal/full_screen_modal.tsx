// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {CSSTransition} from 'react-transition-group';

import CloseIcon from './close_icon';
import './full_screen_modal.scss';

// This must be in sync with the animation time in full_screen_modal.scss from webapp
const ANIMATION_DURATION = 100;

interface Props {
    show: boolean;
    children: React.ReactElement;
    onClose: () => void;
}

const FullScreenModal = ({show, children, onClose}: Props): React.ReactElement => {
    useEffect(() => {
        function handleKeypress(e: KeyboardEvent): void {
            if (e.key === 'Escape' && show) {
                onClose();
            }
        }

        document.addEventListener('keydown', handleKeypress);

        return function cleanup(): void {
            document.removeEventListener('keydown', handleKeypress);
        };
    });

    return (
        <CSSTransition
            in={show}
            classNames='FullScreenModal'
            mountOnEnter={true}
            unmountOnExit={true}
            timeout={ANIMATION_DURATION}
            appear={true}
        >
            <div className='FullScreenModal IncidentFullScreenModal'>
                <CloseIcon
                    className='close-x'
                    onClick={onClose}
                />
                {children}
            </div>
        </CSSTransition>
    );
};

export default FullScreenModal;
