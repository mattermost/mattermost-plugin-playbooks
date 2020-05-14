// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './seach_input.scss';

interface Props {
    onSearch: (term: string) => void;
}

export default function SearchInput(props: Props) {
    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        props.onSearch(event.target.value);
    };

    return (
        <div className='incident-list-search-container'>
            <input
                className='incident-list-search-container__input'
                type='text'
                placeholder='Search by Incident name'
                onChange={onChange}
            />
        </div>
    );
}
