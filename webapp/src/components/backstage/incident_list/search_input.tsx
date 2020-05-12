// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import './seach_input.scss';

export default function SearchInput() {
    const [term, setTerm] = useState('');

    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTerm(event.target.value);
    };

    return (
        <input
            className='incident-list-search-input'
            type='text'
            placeholder='Search by Incident name'
            value={term}
            onChange={onChange}
        />
    );
}
