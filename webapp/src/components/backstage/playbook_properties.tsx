// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {usePlaybookViewTelemetry} from 'src/hooks/telemetry';
import {PlaybookViewTarget} from 'src/types/telemetry';

interface Props {
    playbookID: string;
}

const PlaybookProperties = ({playbookID}: Props) => {
    usePlaybookViewTelemetry(PlaybookViewTarget.Properties, playbookID);

    return (
        <OuterContainer>
            <InnerContainer>
                <h1>Properties page</h1>
            </InnerContainer>
        </OuterContainer>
    );
};

const OuterContainer = styled.div`
    height: 100%;
`;

const InnerContainer = styled.div`
    display: flex;
    max-width: 1120px;
    flex-direction: column;
    padding: 20px;
    margin: 0 auto;
    font-family: 'Open Sans', sans-serif;
    font-style: normal;
    font-weight: 600;

    > div + div {
        margin-top: 16px;
    }
`;

export default styled(PlaybookProperties)`/* stylelint-disable no-empty-source */`;