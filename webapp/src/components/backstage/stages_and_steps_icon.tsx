import React, {FC} from 'react';
import styled from 'styled-components';

const BlueBox = styled.div`
    background-color: rgb(var(--button-bg-rgb));
    width: 32px;
    height: 32px;
    border-radius: 4px;
    display: inline-block;
    color: rgb(var(--sidebar-text-rgb));
    font-size: 14px;
    text-align: center;
    padding-top: 4px;
`;

const StagesAndStepsIcon: FC = () => (
    <BlueBox>
        <i className='fa fa-location-arrow'/>
    </BlueBox>
);

export default StagesAndStepsIcon;
