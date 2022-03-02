// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import Icon from 'src/components/assets/svg';

const Svg = styled(Icon)`
    width: 26px;
    height: 30px;
    color: var(--button-bg)
`;

const ClipboardsCheckmark = (props: {className?: string}) => (
    <Svg
        className={props.className}
        viewBox='0 0 26 30'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <path
            d='M2.57971 8.69967V26.92H20.8V29.5403H2.57971C1.88909 29.5403 1.27971 29.2762 0.751587 28.7481C0.264087 28.2606 0.020337 27.6512 0.020337 26.92V8.69967H2.57971ZM14.036 19.5465L9.77034 15.2809L11.5985 13.4528L14.036 15.9512L19.6422 10.345L21.4703 12.1731L14.036 19.5465ZM23.4203 3.51998C24.111 3.51998 24.7 3.78404 25.1875 4.31217C25.7157 4.79967 25.9797 5.40904 25.9797 6.14029V21.7403C25.9797 22.4309 25.7157 23.0403 25.1875 23.5684C24.7 24.0559 24.111 24.2997 23.4203 24.2997H7.82034C7.08909 24.2997 6.4594 24.0559 5.93127 23.5684C5.44377 23.0403 5.20002 22.4309 5.20002 21.7403V6.14029C5.20002 5.40904 5.44377 4.79967 5.93127 4.31217C6.4594 3.78404 7.08909 3.51998 7.82034 3.51998H11.9641C12.2078 2.74811 12.6547 2.11842 13.3047 1.63092C13.9953 1.14342 14.7469 0.89967 15.5594 0.89967C16.4125 0.89967 17.1641 1.14342 17.8141 1.63092C18.5047 2.11842 18.9922 2.74811 19.2766 3.51998H23.4203ZM15.6203 3.51998C15.2547 3.51998 14.9297 3.66217 14.6453 3.94654C14.4016 4.19029 14.2797 4.49498 14.2797 4.86061C14.2797 5.18561 14.4016 5.49029 14.6453 5.77467C14.9297 6.01842 15.2344 6.14029 15.5594 6.14029C15.925 6.14029 16.2297 6.01842 16.4735 5.77467C16.7578 5.49029 16.9 5.18561 16.9 4.86061C16.9 4.49498 16.7578 4.19029 16.4735 3.94654C16.2297 3.66217 15.9453 3.51998 15.6203 3.51998ZM10.3797 8.69967V6.14029H7.82034V21.7403H23.4203V6.14029H20.8V8.69967H10.3797Z'
            fill='currentColor'
            opacity='0.84'
        />
    </Svg>
);

export default ClipboardsCheckmark;
