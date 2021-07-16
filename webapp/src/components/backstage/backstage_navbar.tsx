import styled from 'styled-components';

export const BackstageNavbarIcon = styled.button`
    border: none;
    outline: none;
    background: transparent;
    border-radius: 4px;
    font-size: 24px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--center-channel-color-56);

    &:hover {
        background: var(--button-bg-08);
        text-decoration: unset;
        color: var(--button-bg);
    }
`;

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
    box-shadow: inset 0px -1px 0px var(--center-channel-color-16);

    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 600;
`;

