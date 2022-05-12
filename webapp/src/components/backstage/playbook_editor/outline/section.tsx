// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {useState} from 'react';
import {useRouteMatch} from 'react-router-dom';

import CopyLink from 'src/components/widgets/copy_link';
import {getSiteUrl} from 'src/client';

interface Props {
    id: string;
    title: string;
    children?: React.ReactNode;
    headerRight?: React.ReactNode;
    hoverEffect?: boolean;
}

const Section = ({
    id,
    title,
    headerRight,
    children,
    hoverEffect,
}: Props) => {
    const {url} = useRouteMatch();

    return (
        <Wrapper
            id={id}
            $hoverEffect={hoverEffect}
        >
            <Header>
                <Title>
                    <CopyLink
                        id={`section-link-${id}`}
                        to={getSiteUrl() + `${url}#${id}`}
                        name={title}
                        area-hidden={true}
                    />
                    {title}
                </Title>
                {headerRight && (
                    <HeaderRight>
                        {headerRight}
                    </HeaderRight>
                )}
            </Header>
            {children}
        </Wrapper>
    );
};

const Wrapper = styled.div<{$hoverEffect?: boolean; $hideHeaderRight?: boolean;}>`
    ${({$hoverEffect}) => $hoverEffect && css`
        ${HeaderRight} {
            opacity: 0
        }
        :hover,
        :focus-within {
            background: rgba(var(--center-channel-color-rgb), 0.04);
            ${HeaderRight} {
                opacity: 1;
            }
        }
    `}
    padding: 0.5rem 3rem 2rem;
    border-radius: 8px;
`;

const HeaderRight = styled.div``;

const Title = styled.h3`
    font-family: Metropolis, sans-serif;
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
    white-space: nowrap;

    ${CopyLink} {
        margin-left: -1.25em;
        opacity: 1;
        transition: opacity ease 0.15s;
    }

    &:not(:hover) ${CopyLink}:not(:hover) {
        opacity: 0;
    }
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

export default Section;
