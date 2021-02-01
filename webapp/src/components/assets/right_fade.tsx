import styled from 'styled-components';

const RightFade = styled.div`
    position: absolute;
    top: 85px;
    right: 0;
    height: 100%;
    width: 188px;
    z-index: -1;
    background: linear-gradient(270deg, var(--center-channel-bg), rgba(var(--center-channel-bg-rgb), 0) 60%);
    pointer-events: none;
`;

export default RightFade;
