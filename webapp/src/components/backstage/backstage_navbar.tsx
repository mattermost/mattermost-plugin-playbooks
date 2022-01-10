import styled from 'styled-components';

export const BackstageNavbar = styled.div`
    position: sticky;
    width: 100%;
    top: 0;
    z-index: 2;

    display: flex;
    align-items: center;
    padding: 28px 31px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-family: 'compass-icons';
    box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);

    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 600;
`;
