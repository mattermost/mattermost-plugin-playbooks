// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React, {FC} from 'react';

interface Props {
    theme: Record<string, string>;
}

const IncidentRHSIcon: FC<Props> = (props: Props) => {
    return (
        <span>
            <svg
                aria-hidden='true'
                focusable='false'
                width='12'
                height='24'
                fill='none'
                viewBox='0 0 12 24'
                xmlns='http://www.w3.org/2000/svg'
            >
                <path
                    d='M8.10938 2.25C8.4375 2.25 8.71875 2.53125 8.67188 2.85938L8.15625 13.3594C8.10938 13.6875 7.875 13.875 7.59375 13.875H4.35938C4.07812 13.875 3.84375 13.6875 3.79688 13.3594L3.28125 2.85938C3.23438 2.53125 3.51562 2.25 3.84375 2.25H8.10938ZM6 15.75C7.64062 15.75 9 17.1094 9 18.75C9 20.4375 7.64062 21.75 6 21.75C4.3125 21.75 3 20.4375 3 18.75C3 17.1094 4.3125 15.75 6 15.75ZM8.10938 0H3.84375C2.20312 0 0.9375 1.35938 1.03125 3L1.54688 13.5C1.59375 14.1094 1.82812 14.6719 2.20312 15.1406C1.3125 16.0781 0.75 17.3438 0.75 18.75C0.75 21.6562 3.09375 24 6 24C8.85938 24 11.25 21.6562 11.25 18.75C11.25 17.3438 10.6406 16.0781 9.75 15.1406C10.0781 14.7188 10.3594 14.0156 10.4062 13.5L10.9219 3C11.0156 1.35938 9.75 0 8.10938 0Z'
                    fill={props.theme.buttonBg}
                />
            </svg>
        </span>
    );
};

export default IncidentRHSIcon;
