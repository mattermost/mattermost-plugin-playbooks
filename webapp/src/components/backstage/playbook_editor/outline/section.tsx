// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';
import {useRouteMatch} from 'react-router-dom';

import CopyLink from 'src/components/widgets/copy_link';
import {getSiteUrl} from 'src/client';

interface Props {
    id: string;
    title: string;
    children?: React.ReactNode;
}

const Section = ({id, title, children}: Props) => {
    const {url} = useRouteMatch();
    return (
        <Wrapper id={id}>
            <Title>
                <CopyLink
                    id={`section-link-${id}`}
                    to={getSiteUrl() + `${url}#${id}`}
                    name={title}
                    area-hidden={true}
                />
                {title}
            </Title>
            {children}
        </Wrapper>
    );
};

const Wrapper = styled.div`
    :not(:last-child) {
        margin-bottom: 40px;
    }
`;

const Title = styled.h3`
    font-family: Metropolis, sans-serif;
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;

    margin-top: 0;
    margin-bottom: 16px;

    ${CopyLink} {
        margin-left: -1.25em;
        opacity: 1;
        transition: opacity ease 0.15s;
    }

    &:not(:hover) ${CopyLink}:not(:hover) {
        opacity: 0;
    }
`;

export default Section;
