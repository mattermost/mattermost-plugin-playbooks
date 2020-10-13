import styled from 'styled-components';

const LeftFade = styled.div`
    position: absolute;
    width: 176px;
    top: 85px;
    left: 0;
    height: 100%;
    background: linear-gradient(90deg, var(--center-channel-bg) 0%, rgba(255, 255, 255, 0) 94.89%);
    pointer-events: none;
    z-index: -1;
`;

export default LeftFade;
