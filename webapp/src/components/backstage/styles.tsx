// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import AsyncSelect from 'react-select/async';
import Select from 'react-select';

export const BackstageHeader = styled.div`
    padding: 20px 0 0 31px;
`;

export const BackstageHeaderTitle = styled.div`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
`;

export const BackstageHeaderHelpText = styled.div`
    font-weight: normal;
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

export const BackstageSubheader = styled.div`
    display: flex;
    align-items: center;
    height: 72px;
    min-height: 72px;
    padding: 0 24px;
    font-weight: 600;
    font-size: 16px;
    border-bottom: 1px solid var(--center-channel-color-16);
`;

export const BackstageSubheaderText = styled.div`
    font-weight: 600;
    margin: 0 0 16px;
`;

export const BackstageSubheaderDescription = styled.div`
    margin: 8px 0 0;
    font-weight: 400;
    color: var(--center-channel-color-64);
`;

export const TabContainer = styled.div`
    margin: 24px;
    max-width: 700px;
`;

export const StyledTextarea = styled.textarea`
    transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;
    width: 100%;
    resize: none;
    height: 100px;
    background-color: rgb(var(--center-channel-bg-rgb));
    border: none;
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    padding: 10px 25px 0 16px;
    font-size: 14px;
    line-height: 20px;

    &:focus {
        box-shadow: inset 0 0 0 2px var(--button-bg);
    }
`;

const commonSelectStyle = css`
    flex-grow: 1;
    background-color: var(--center-channel-bg);

    .channel-selector__menu-list {
        background-color: var(--center-channel-bg);
        border: none;
    }

    .channel-selector__input {
        color: var(--center-channel-color);
    }

    .channel-selector__option--is-selected {
        background-color: var(--center-channel-color-08);
        color: inherit;
    }

    .channel-selector__option--is-focused {
        background-color: var(--center-channel-color-16);
    }

    .channel-selector__control {
        transition: all 0.15s ease;
        transition-delay: 0s;
        background-color: transparent;
        border-radius: 4px;
        border: none;
        box-shadow: inset 0 0 0 1px var(--center-channel-color-16);
        width: 100%;
        height: 4rem;
        font-size: 14px;

        &--is-focused {
            box-shadow: inset 0 0 0px 2px var(--button-bg);
        }
    }

    .channel-selector__option {
        &:active {
            background-color: var(--center-channel-color-08);
        }
    }

    .channel-selector__single-value {
        color: var(--center-channel-color);
    }
`;

export const StyledAsyncSelect = styled(AsyncSelect)`
    ${commonSelectStyle}
`;

export const StyledSelect = styled(Select)`
    ${commonSelectStyle}
`;
