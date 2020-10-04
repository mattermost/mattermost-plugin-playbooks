import styled from 'styled-components';

const RightFade = styled.div`
    position: absolute;
    top: 85px;
    right: 0;
    height: 100%;
    width: 188px;
    z-index: 0;
    background: linear-gradient(270deg, var(--center-channel-bg),transparent 60%);
    pointer-events: none;
`;

export default RightFade;
