import React, {FC} from 'react';
import styled from 'styled-components';

const StagesAndStepsBox = styled.div`
    width: 40px;
    height: 40px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--button-bg);
    background: transparent;
    margin: 0 8px 0 0;
    text-align: center;
`;

const StagesAndStepsIcon: FC = () => (
    <StagesAndStepsBox>
        <i className='icon-20 icon-check-circle-outline'/>
    </StagesAndStepsBox>
);

export default StagesAndStepsIcon;
