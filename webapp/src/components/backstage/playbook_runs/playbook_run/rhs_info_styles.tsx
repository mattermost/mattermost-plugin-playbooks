// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Link} from 'react-router-dom';
import styled from 'styled-components';

export const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

export const Section = styled.section`
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 24px 0;
`;

type LinkType = {to: string, name: string} | {onClick: () => void, name: string};

interface SectionHeaderProps {
    title: string;
    link?: LinkType;
}

export const SectionHeader = ({title, link}: SectionHeaderProps) => (
    <SectionHeaderContainer>
        <SectionTitle>{title}</SectionTitle>
        {link && <SectionLink link={link}/>}
    </SectionHeaderContainer>
);

const SectionLink = ({link}: {link: LinkType}) => {
    if ('to' in link) {
        return (
            <StyledLink to={link.to}>
                {link.name}
            </StyledLink>
        );
    }

    return (
        <StyledSpan onClick={link.onClick}>
            {link.name}
        </StyledSpan>
    );
};

const SectionHeaderContainer = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;

    padding: 0 24px;
    margin-bottom: 8px;
`;

const SectionTitle = styled.div`
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;

    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const StyledLink = styled(Link)`
    font-weight: 600;
    font-size: 12px;
    color: var(--button-bg);

    opacity: 0;
    ${Section}:hover & {
        opacity: 100%;
    }

    transition: opacity .2s;
`;

const StyledSpan = styled.span`
    font-weight: 600;
    font-size: 12px;
    color: var(--button-bg);
    cursor: pointer;

    :hover{
        text-decoration: underline;
    }

    opacity: 0;
    ${Section}:hover & {
        opacity: 100%;
    }

    transition: opacity .2s;
`;
