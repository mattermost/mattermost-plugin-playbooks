// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';

import {PlaybookRun} from 'src/types/playbook_run';
import {updateStatus} from 'src/actions';

import './playbook_run_details.scss';
import {PrimaryButton} from 'src/components/assets/buttons';

interface Props {
    playbookRun: PlaybookRun;
    collapsed: boolean;
}

const RHSPostUpdate = (props: Props) => {
    const dispatch = useDispatch();
    const icon = <ClockIcon/>;

    return (
        <PostUpdate>
            <Timer>
                <IconWrapper collapsed={props.collapsed}>
                    {icon}
                </IconWrapper>
                <UpdateNotice collapsed={props.collapsed}>
                    <UpdateNoticePretext>
                        {'Update due in'}
                    </UpdateNoticePretext>
                    <UpdateNoticeTime collapsed={props.collapsed}>
                        {'50 min'}
                    </UpdateNoticeTime>
                </UpdateNotice>
            </Timer>
            <Spacer/>
            <Button
                collapsed={props.collapsed}
                onClick={() => dispatch(updateStatus())}
            >
                {'Post update'}
            </Button>
        </PostUpdate>
    );
};

const Spacer = styled.div`
    flex-grow: 0;
    flex-shrink: 0;
    width: 44px;
`;

const PostUpdate = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;

    justify-content: space-between;
    padding: ${(props) => (props.collapsed ? '12px' : '8px')};
    padding-left: 12px;

    background-color: var(--center-channel-bg);

    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
`;

const Timer = styled.div`
    flex-grow: 0;
    flex-shrink: 0;
    display: flex;
    flex-direction: row;
    align-items: center
`;

const IconWrapper = styled.span<{collapsed: boolean}>`
    display: flex;
    justify-content: center;
    align-items: center;

    width: ${(props) => (props.collapsed ? '14px' : '48px')};
`;

const UpdateNotice = styled.div<{collapsed: boolean}>`
    display: flex;
    flex-direction: ${(props) => (props.collapsed ? 'row' : 'column')};
    margin-left: 4px;
    padding: 0;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    font-size: 12px;
    line-height: 16px;
`;

const UpdateNoticePretext = styled.div`
    font-weight: 400;
    margin-right: 3px;
`;

const UpdateNoticeTime = styled.div<{collapsed: boolean}>`
    font-weight: 600;

    ${(props) => !props.collapsed && css`
        font-size: 16px;
        line-height: 24px;
    `}
`;

const Button = styled(PrimaryButton)<{collapsed: boolean}>`
    justify-content: center;
    flex: 1;
    ${(props) => props.collapsed && css`
        height: 32px;
        font-size: 12px;
        font-height: 9.5px;
    `}
`;

const ClockIcon = () => (
    <svg
        width='34'
        height='34'
        viewBox='0 0 34 34'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <path
            d='M33.5 13.968H21.092L26.108 8.77605C24.4653 7.16272 22.544 6.06271 20.344 5.47605C18.144 4.86005 15.9587 4.81605 13.788 5.34405C11.5587 5.90138 9.62267 7.00138 7.98 8.64405C6.33733 10.2574 5.22267 12.164 4.636 14.364C4.07867 16.5054 4.07867 18.6467 4.636 20.788C5.22267 22.988 6.33733 24.9094 7.98 26.552C9.62267 28.1947 11.5587 29.2947 13.788 29.852C15.9587 30.4387 18.1293 30.4387 20.3 29.852C22.5293 29.2947 24.4653 28.1947 26.108 26.552C27.3693 25.2907 28.308 23.9267 28.924 22.46C29.54 20.9934 29.848 19.3654 29.848 17.576H33.5C33.5 19.512 33.0893 21.492 32.268 23.516C31.388 25.716 30.1853 27.5787 28.66 29.104C26.548 31.1867 24.0547 32.6094 21.18 33.372C18.3933 34.076 15.6067 34.076 12.82 33.372C9.94533 32.6094 7.452 31.1867 5.34 29.104C3.228 27.0214 1.79067 24.5574 1.028 21.712C0.294667 18.9547 0.294667 16.1974 1.028 13.44C1.76133 10.5947 3.184 8.13071 5.296 6.04805C7.408 3.96538 9.88667 2.54271 12.732 1.78005C15.4893 1.07605 18.2613 1.07605 21.048 1.78005C23.8933 2.54271 26.372 3.96538 28.484 6.04805L33.5 0.900048V13.968ZM17.924 10.052V17.84L24.348 21.668L23.028 23.868L15.152 19.248V10.052H17.924Z'
            fill='#3D3C40'
            fillOpacity='0.32'
        />
    </svg>
);

const ExclamationIcon = () => (
    <svg
        width='38'
        height='37'
        viewBox='0 0 38 37'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <path
            d='M19 0.052048C15.6853 0.052048 12.6053 0.888048 9.76 2.56005C7.00267 4.20271 4.80267 6.40271 3.16 9.16005C1.488 12.0054 0.652 15.0854 0.652 18.4C0.652 21.7147 1.488 24.7947 3.16 27.64C4.80267 30.3974 7.00267 32.5974 9.76 34.24C12.6053 35.912 15.6853 36.748 19 36.748C22.3147 36.748 25.3947 35.912 28.24 34.24C30.9973 32.5974 33.1973 30.3974 34.84 27.64C36.512 24.7947 37.348 21.7147 37.348 18.4C37.348 15.0854 36.512 12.0054 34.84 9.16005C33.1973 6.40271 30.9973 4.20271 28.24 2.56005C25.3947 0.888048 22.3147 0.052048 19 0.052048ZM19 33.052C16.36 33.052 13.896 32.3774 11.608 31.028C9.408 29.7374 7.66267 27.992 6.372 25.792C5.02267 23.504 4.348 21.04 4.348 18.4C4.348 15.76 5.02267 13.296 6.372 11.008C7.66267 8.80805 9.408 7.06271 11.608 5.77205C13.896 4.42271 16.36 3.74805 19 3.74805C21.64 3.74805 24.104 4.42271 26.392 5.77205C28.592 7.06271 30.3373 8.80805 31.628 11.008C32.9773 13.296 33.652 15.76 33.652 18.4C33.652 21.04 32.9773 23.504 31.628 25.792C30.3373 27.992 28.592 29.7374 26.392 31.028C24.104 32.3774 21.64 33.052 19 33.052ZM19.924 20.248H18.076L17.152 9.24805H20.848L19.924 20.248ZM20.848 25.748C20.848 26.2467 20.6573 26.672 20.276 27.024C19.924 27.376 19.4987 27.552 19 27.552C18.5013 27.552 18.0613 27.376 17.68 27.024C17.328 26.672 17.152 26.2467 17.152 25.748C17.152 25.2494 17.328 24.824 17.68 24.472C18.0613 24.0907 18.5013 23.9 19 23.9C19.4987 23.9 19.924 24.0907 20.276 24.472C20.6573 24.824 20.848 25.2494 20.848 25.748Z'
            fill='#F74343'
        />
    </svg>
);

export default RHSPostUpdate;
