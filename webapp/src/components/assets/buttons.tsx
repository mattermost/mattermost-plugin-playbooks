// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React, {FC} from 'react';
import styled from 'styled-components';


export const PrimaryButton = styled.button`
    display: inline-flex;
    align-items: center;
    height: 40px;
    background: var(--button-bg);
    color: var(--button-color);
    border-radius: 4px;
    border: 0px;
    font-weight: 600;
    font-size: 14px;
    align-items: center;
    padding: 0 20px;
    position: relative;

    > span {
        display: flex;
        position: relative;
        z-index: 1;
        align-items: center;
    }

    &:before {
        content: '';
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        transition: all 0.15s ease-out;
        position: absolute;
        background: var(--center-channel-color-16);
        opacity: 0;
    }

    &:hover {
        &:before {
            opacity: 1;
        }
    }

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.8);
    }

    &:disabled {
        background: rgba(var(--button-bg-rgb), 0.4);
    }

    i {
        display: flex;
        font-size: 18px;
    }
`;

export const TertiaryButton = styled.button`
    background: transparent;
    display: inline-flex;
    align-items: center;
    height: 40px;
    color: var(--button-bg);
    border-radius: 4px;
    border: 0px;
    font-weight: 600;
    font-size: 14px;
    align-items: center;
    padding: 0 20px;
    transition: all 0.15s ease-out;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
    }

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.16);
    }

    i {
        display: flex;
        font-size: 18px;

        &:before {
            margin: 0 7px 0 0;
        }
    }
`;

