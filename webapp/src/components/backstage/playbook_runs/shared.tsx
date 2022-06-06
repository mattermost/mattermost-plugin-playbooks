// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import {useRouteMatch} from 'react-router-dom';
import React from 'react';

import StatusBadge from 'src/components/backstage/status_badge';

import {PrimaryButton, SecondaryButton} from 'src/components/assets/buttons';
import {SemiBoldHeading} from 'src/styles/headings';

import {BaseInput} from 'src/components/assets/inputs';
import {getSiteUrl} from 'src/client';
import CopyLink from 'src/components/widgets/copy_link';

export const Container = styled.div`
    display: flex;
    height: 100%;
`;

export const Left = styled.div`
    flex: 2;
    min-width: 0;
`;

export const Right = styled.div`
    flex: 1;
    margin-left: 20px;
`;

export const TabPageContainer = styled.div`
    font-size: 12px;
    font-weight: normal;
    margin-bottom: 20px;
`;

export const Title = styled.div`
    ${SemiBoldHeading} {
    }
    color: var(--center-channel-color);
    font-size: 18px;
    font-weight: 600;
`;

export const Content = styled.div`
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    margin: 8px 0 0 0;
    padding: 0 8px 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
`;

export const EmptyBody = styled.div`
    margin: 16px 0 24px 0;
    font-size: 14px;
`;

export const SecondaryButtonSmaller = styled(SecondaryButton)`
    padding: 0 20px;
    height: 26px;
    font-size: 12px;
    margin-left: 20px;
`;

export const SecondaryButtonRight = styled(SecondaryButtonSmaller)`
    margin-left: auto;
`;

export const SecondaryButtonLarger = styled(SecondaryButtonSmaller)`
    padding: 0 16px;
    height: 36px;
`;

export const SecondaryButtonLargerRight = styled(SecondaryButtonLarger)`
    margin-left: auto;
`;

export const ExpandRight = styled.div`
    margin-left: auto;
`;

export const PrimaryButtonRight = styled(PrimaryButton)`
    height: 26px;
    padding: 0 14px;
    margin-left: auto;
    font-size: 12px;
`;

export const PrimaryButtonLarger = styled(PrimaryButton)`
    padding: 0 16px;
    height: 36px;
    font-size: 12px;
`;

export const Badge = styled(StatusBadge)`
    display: unset;
    position: unset;
    height: unset;
    white-space: nowrap;
`;

export const Icon16 = styled.i`
    && {
        font-size: 16px;
    }
`;

export const HelpText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-weight: 400;
`;

export const ErrorText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: var(--error-text);
`;

export const StyledInput = styled(BaseInput)<{error?: boolean}>`
    height: 40px;
    width: 100%;

    background-color: ${(props) => (props.disabled ? 'rgba(var(--center-channel-color-rgb), 0.03)' : 'var(--center-channel-bg)')};

    ${(props) => (
        props.error && css`
            box-shadow: inset 0 0 0 1px var(--error-text);

            &:focus {
                box-shadow: inset 0 0 0 2px var(--error-text);
            }
        `
    )}
`;

interface AnchorLinkTitleProps {
    title: string;
    id: string;

}

export const AnchorLinkTitle = (props: AnchorLinkTitleProps) => {
    const {url} = useRouteMatch();

    return (
        <LinkTitle>
            <CopyLink
                id={`section-link-${props.id}`}
                to={getSiteUrl() + `${url}#${props.id}`}
                name={props.title}
                area-hidden={true}
            />
            {props.title}
        </LinkTitle>
    );
};

const LinkTitle = styled.h3`
    font-family: Metropolis, sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    padding-left: 8px;
    margin: 0;
    white-space: nowrap;
    display: inline-block;

    ${CopyLink} {
        margin-left: -1.25em;
        opacity: 1;
        transition: opacity ease 0.15s;
    }
    &:not(:hover) ${CopyLink}:not(:hover) {
        opacity: 0;
    }
`;
