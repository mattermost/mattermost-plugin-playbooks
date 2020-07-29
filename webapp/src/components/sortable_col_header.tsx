// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';
import styled from 'styled-components';

const Header = styled.div`
    cursor: pointer;
`;

interface Props {
    name: string;
    order: string;
    active: boolean;
    onClick: () => void;
}

export function SortableColHeader(props: Props) {
    const chevron = classNames('icon--small', 'ml-2', {
        'icon-chevron-down': props.order === 'desc',
        'icon-chevron-up': props.order === 'asc',
    });

    return (
        <Header
            onClick={() => props.onClick()}
        >
            {props.name}
            {
                props.active &&
                <i className={chevron}/>
            }
        </Header>
    );
}
