// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {CSSTransition} from 'react-transition-group';

import {BackstageArea} from 'src/types/backstage';

import Backstage from '../backstage';

// This must be in sync with the animation time in full_screen_modal.scss from webapp
const ANIMATION_DURATION = 100;

interface Props {
    show: boolean;
    close: () => void;
    selectedArea: BackstageArea;
}

const BackstageModal = ({show, close, selectedArea}: Props): React.ReactElement => {
    return (
        <CSSTransition
            in={show}
            classNames='FullScreenModal'
            mountOnEnter={true}
            unmountOnExit={true}
            timeout={ANIMATION_DURATION}
            appear={true}
        >
            <div className='FullScreenModal'>
                <Backstage
                    onBack={close}
                    selectedArea={selectedArea}
                />
            </div>
        </CSSTransition>
    );
};

export default BackstageModal;
