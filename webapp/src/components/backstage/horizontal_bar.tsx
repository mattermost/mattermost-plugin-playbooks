import React from 'react';
import styled from 'styled-components';

export interface HorizontalBarProps {
    children: React.ReactNode;
}

export const Container = styled.div`
    display: flex;
    flex-direction: row;
    width: 100%;
    line-height: 0.1em;
    margin-bottom: 12px;
`;

export const Line = styled.hr`
    width: 100%;
    margin: auto 0;
    display: inline-block;
    flex-grow: 1;
`;

const Children = styled.div`
    flex-shrink: 0;
    display: flex;
    align-items: center;
`;

const HorizontalBar = (props: HorizontalBarProps) => {
    return (
        <Container>
            <Children>
                {props.children}
            </Children>
            <Line/>
        </Container>
    );
};

export default HorizontalBar;
