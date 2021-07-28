// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';

import {updateStatus} from 'src/actions';


interface Props {
    collapsed: boolean;
}

const RHSPostUpdate = (props: Props) => {
    const dispatch = useDispatch();

    return (
        <PostUpdate collapsed={props.collapsed}>
            <Button
                collapsed={props.collapsed}
                onClick={() => dispatch(updateStatus())}
            >
                {'Post update'}
            </Button>
        </PostUpdate>
    );
};

const PostUpdate = styled.div<{collapsed: boolean}>`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;

    justify-content: space-between;
    padding: ${(props) => (props.collapsed ? '8px' : '12px')};

    background-color: var(--center-channel-bg);

    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
`;

const Button = styled(PrimaryButton)<{collapsed: boolean}>`
    justify-content: center;
    flex: 1;
    ${(props) => props.collapsed && css`
        height: 32px;
        font-size: 12px;
        font-height: 9.5px;
    `}
`;

export default RHSPostUpdate;
