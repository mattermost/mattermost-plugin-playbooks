// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css, createGlobalStyle} from 'styled-components';
import AsyncSelect from 'react-select/async';
import Select from 'react-select';
import Creatable from 'react-select/creatable';

import {RegularHeading} from 'src/styles/headings';
import MarkdownTextbox from 'src/components/markdown_textbox';
import {pluginId} from 'src/manifest';

export const Banner = styled.div`
    color: var(--button-color);
    background-color: var(--button-bg);
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 8;
    overflow: hidden;
    padding: 1rem 2.4rem;
    text-align: center;
`;

export const BackstageHeader = styled.div`
    ${RegularHeading}

    display: flex;
    font-size: 2.8rem;
    line-height: 3.6rem;
    align-items: center;
    padding: 4rem 0 3.2rem;
`;

export const TeamContainer = styled.div`
    opacity: 0.56;
    margin-left: 1rem;
`;

export const BackstageSubheader = styled.div`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
`;

export const BackstageSubheaderDescription = styled.div`
    font-weight: normal;
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin: 0 0 16px;
`;

export const TabContainer = styled.div`
    margin: 24px;
    max-width: 700px;
`;

export const StyledTextarea = styled.textarea`
    transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;
    width: 100%;
    resize: none;
    height: 160px;
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

export const StyledMarkdownTextbox = styled(MarkdownTextbox)`
    .custom-textarea {
        background-color: var(--center-channel-bg);
        border-radius: 4px;
        padding: 10px 25px 0 16px;
        font-size: 14px;
        line-height: 20px;
    }
    .textbox-preview-area {
        z-index: auto;
    }
`;

export const GlobalSelectStyle = createGlobalStyle`
    .playbooks-rselect__control.playbooks-rselect__control {
        transition: all 0.15s ease;
        transition-delay: 0s;
        background-color: transparent;
        border-radius: 4px;
        border: none;
        box-shadow: inset 0 0 0 1px var(--center-channel-color-16);
        width: 100%;
        font-size: 14px;

        &--is-focused {
            box-shadow: inset 0 0 0px 2px var(--button-bg);
        }
    }

    .playbooks-rselect__control,
    .playbooks-rselect__menu {
        .playbooks-rselect__menu-list {
            background-color: var(--center-channel-bg);
            border: none;
        }

        .playbooks-rselect__input {
            color: var(--center-channel-color);
        }

        .playbooks-rselect__option--is-selected {
            background-color: var(--center-channel-color-08);
            color: inherit;
        }

        .playbooks-rselect__option--is-focused {
            background-color: var(--center-channel-color-16);
        }

        .playbooks-rselect__option {
            &:active {
                background-color: var(--center-channel-color-08);
            }
        }

        .playbooks-rselect__single-value {
            color: var(--center-channel-color);
        }

        .playbooks-rselect__multi-value {
            height: 20px;
            line-height: 19px;
            background-color: var(--center-channel-color-08);
            border-radius: 10px;
            padding-left: 8px;

            .playbooks-rselect__multi-value__label {
                padding: 0;
                color: var(--center-channel-color);
            }
            .playbooks-rselect__multi-value__remove {
                color: var(--center-channel-bg-80);
            }
        }
    }
`;

const commonSelectStyle = css`
    flex-grow: 1;
    background-color: var(--center-channel-bg);
`;

export const StyledAsyncSelect = styled(AsyncSelect).attrs((props) => {
    return {
        classNamePrefix: 'playbooks-rselect',
        ...props,
    };
})`
    ${commonSelectStyle}
`;

export const StyledSelect = styled(Select).attrs((props) => {
    return {
        classNamePrefix: 'playbooks-rselect',
        ...props,
    };
})`
    ${commonSelectStyle}
`;

export const StyledCreatable = styled(Creatable)`
    ${commonSelectStyle}
`;

export const BackstageHorizontalContentSquish = styled.div`
    margin: 0 auto;
    max-width: 1160px;
    padding: 0 20px;
`;

export const RadioContainer = styled.div`
    display: flex;
    flex-direction: column;
    margin-top: 8px;
    margin-bottom: 16px;
`;

export const RadioLabel = styled.label`
    && {
        margin: 0 0 8px;
        display: flex;
        align-items: center;
        font-size: 14px;
        font-weight: normal;
        line-height: 20px;
    }
`;

export const RadioInput = styled.input`
    && {
        width: 16px;
        height: 16px;
        margin: 0 8px 0 0;
    }
`;

export const CenteredRow = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
`;

export const InfoLine = styled.div`
    font-style: normal;
    font-weight: normal;
    font-size: 11px;
    line-height: 16px;
    color: var(--center-channel-color-56);
`;

interface PlaybookRunFilterButtonProps {
    active?: boolean;
}

export const PlaybookRunFilterButton = styled.button<PlaybookRunFilterButtonProps>`
    display: flex;
    align-items: center;
    border: none;
    border-radius: 4px;
    color: var(--center-channel-color-56);
    background: transparent;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    line-height: 12px;
    -webkit-transition: all 0.15s ease;
    -webkit-transition-delay: 0s;
    -moz-transition: all 0.15s ease;
    -o-transition: all 0.15s ease;
    transition: all 0.15s ease;
    padding: 0 16px;
    height: 4rem;

    :hover {
        background: var(--center-channel-color-08);
        color: var(--center-channel-color-72);
    }

    :active {
        background: var(--button-bg-08);
        color: var(--button-bg);
    }

    .icon-chevron-down {
        :before {
            margin: 0;
        }
    }

    ${(props) => props.active && css`
        cursor: pointer;
        background: var(--button-bg-08);
        color: var(--button-bg);
    `}
`;
