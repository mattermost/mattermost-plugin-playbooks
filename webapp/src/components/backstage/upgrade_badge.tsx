import React from 'react';
import styled from 'styled-components';

import Tooltip from 'src/components/widgets/tooltip';

interface Props {
    className?: string;
    id?: string;
    tooltipText?: string;
}

const UpgradeBadge = (props: Props) => {
    const svg = (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            version='1.1'
            width='24'
            height='24'
            viewBox='2 2 20 20'
            className={props.className}
        >
            <circle
                cx='12'
                cy='12'
                r='10'
                fill='white'
            />
            <path
                d='M12,2c5.523,0,10,4.477,10,10s-4.477,10-10,10S2,17.523,2,12S6.477,2,12,2z M14.994,9.033
        c0.218,0.217,0.327,0.47,0.327,0.76s-0.109,0.543-0.327,0.76c-0.218,0.217-0.472,0.326-0.762,0.326s-0.545-0.109-0.762-0.326
        c-0.218-0.217-0.327-0.47-0.327-0.76s0.109-0.543,0.327-0.76c0.218-0.217,0.472-0.326,0.762-0.326S14.776,8.816,14.994,9.033z
        M16.555,7.477C15.902,6.826,15.115,6.5,14.195,6.5c-0.871,0-1.634,0.326-2.287,0.977c-0.508,0.507-0.823,1.11-0.944,1.809
        c-0.097,0.675,0.012,1.315,0.327,1.918L6.5,15.98l1.525,1.52l1.561-1.556l1.561,1.556l1.525-1.52l-1.561-1.556l1.706-1.701
        c0.605,0.314,1.246,0.422,1.924,0.326c0.702-0.121,1.307-0.434,1.815-0.941c0.653-0.651,0.968-1.423,0.944-2.316
        C17.523,8.9,17.208,8.128,16.555,7.477z'
                fill='var(--online-indicator)'
            />
        </svg>
    );

    if (!props.tooltipText) {
        return svg;
    }

    return (
        <Tooltip
            id={props.id}
            content={props.tooltipText}
        >
            {svg}
        </Tooltip>
    );
};

export default styled(UpgradeBadge)`
    width: 16px;
    height: 16px;
`;
