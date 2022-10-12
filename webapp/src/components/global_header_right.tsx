// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import GiveFeedbackButton from 'src/components/give_feedback_button';

const GlobalHeaderGiveFeedbackButton = styled(GiveFeedbackButton)`
    padding: 0 5px;
    font-size: 11px;
`;

const GlobalHeaderRight = () => {
    return (<>
        <GlobalHeaderGiveFeedbackButton/>
    </>);
};

export default GlobalHeaderRight;
