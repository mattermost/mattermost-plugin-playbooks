// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';

interface Props {
    title: string;
    children?: React.ReactNode;
}

const Section = ({title, children}: Props) => {
    return (
        <Wrapper>
            <Title>{title}</Title>
            {children}
        </Wrapper>
    );
};

const Wrapper = styled.div`
    :not(:last-child) {
        margin-bottom: 40px;
    }
`;

const Title = styled.div`
    font-family: Metropolis, sans-serif;
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;

    margin-bottom: 16px;
`;

export default Section;
