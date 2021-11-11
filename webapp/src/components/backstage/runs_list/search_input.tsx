// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

interface Props {
    testId: string;
    default: string | undefined;
    onSearch: (term: string) => void;
}

const RunListSearch = styled.div`
    position: relative;
    max-width: 56rem;
    width: 100%;

    input {
        -webkit-transition: all 0.15s ease;
        -webkit-transition-delay: 0s;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
        transition: all 0.15s ease;
        background-color: transparent;
        border-radius: 4px;
        border: 1px solid var(--center-channel-color-16);
        width: 100%;
        height: 4rem;
        font-size: 14px;
        padding-left: 4rem;

        &:focus {
            box-shadow: inset 0 0 0 1px var(--button-bg);
            border-color: var(--button-bg);
        }
    }

    &:before {
        left: 18px;
        top: 9px;
        position: absolute;
        color: var(--center-channel-color-56);
        content: '\\f349';
        font-size: 20px;
        font-family: 'compass-icons', mattermosticons;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }
`;

export default function SearchInput(props: Props) {
    const {formatMessage} = useIntl();
    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTerm(event.target.value);
        props.onSearch(event.target.value);
    };

    const [term, setTerm] = useState(props.default ? props.default : '');

    return (
        <RunListSearch
            data-testid={props.testId}
        >
            <input
                type='text'
                placeholder={formatMessage({defaultMessage: 'Search by run name'})}
                onChange={onChange}
                value={term}
            />
        </RunListSearch>
    );
}
