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
    onHover?: React.ReactNode;
}

const Section = ({id, title, children, onHover}: Props) => {
    const {url} = useRouteMatch();
    const [showHover, setShowHover] = useState(false);

    return (
        <Wrapper
            id={id}
            onMouseEnter={() => onHover && setShowHover(true)}
            onMouseLeave={() => onHover && setShowHover(false)}
            onHover={onHover !== undefined}
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
                <VerticalSpacer/>
                {showHover && onHover}
            </Header>
            {children}
        </Wrapper>
    );
};

const Wrapper = styled.div<{onHover: boolean}>`
    padding: 24px;

    ${({onHover}) => onHover && css`
        :hover{
            background: var(--center-channel-color-04);
        }
    `}
`;
const Title = styled.h3`
    font-family: Metropolis, sans-serif;
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;

    padding-bottom: 6px;
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
`;

const VerticalSpacer = styled.div`
    width: 100%;
`;

export default Section;
