// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {CSSTransition} from 'react-transition-group';

import {BackstageArea} from 'src/types/backstage';

import Backstage from '../backstage';

// This must be in sync with the animation time in full_screen_modal.scss from webapp
const ANIMATION_DURATION = 100;

interface Props {
    show: boolean;
    close: () => void;
    startingArea: BackstageArea;
}

const BackstageModal = ({show, close, startingArea}: Props) => {
    const [selectedArea, setSelectedArea] = useState<BackstageArea>(BackstageArea.Playbooks);

    // Only set the selected area once when the component mounts or when the redux state is changed.
    useEffect(() => {
        setSelectedArea(startingArea);
    }, [startingArea]);

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
                    setSelectArea={setSelectedArea}
                />
            </div>
        </CSSTransition>
    );
};

export default BackstageModal;
