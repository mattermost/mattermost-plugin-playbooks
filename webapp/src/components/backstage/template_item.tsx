// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes} from 'react';

import styled from 'styled-components';

interface Props {
    title: string;
    label?: string;
    description: string;
    color?: string;
    icon: React.ReactNode;
    author: React.ReactNode;
    onClick?: () => void;
}

const Item = styled.div`
    display: flex;
    flex-direction: column;
    cursor: pointer;
    border-radius: 8px;
`;

type ThumbnailProps = {$color?: string;}
const Thumbnail = styled.div<ThumbnailProps>`
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({$color}) => $color};
    color: var(--button-bg);
    height: 156px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    box-sizing: border-box;
`;

const Label = styled.div`

`;

const Author = styled.div`

`;

const Description = styled.p`

`;

const Detail = styled.div`

`;

const Title = styled.div`
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
    padding: 20px 0 0 0;
    text-align: center;
`;

const TemplateItem = ({
    label,
    title,
    description,
    author,
    icon,
    color,
    ...attrs
}: Props & HTMLAttributes<HTMLDivElement>) => {
    return (
        <Item {...attrs}>
            <Thumbnail $color={color}>
                {label && <Label>{label}</Label>}
                {icon}
            </Thumbnail>
            <Detail>
                <Title>{title}</Title>
                <Description>{description}</Description>
                <Author>{author}</Author>
            </Detail>
        </Item>
    );
};

export default TemplateItem;
