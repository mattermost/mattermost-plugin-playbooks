// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import './seach_input.scss';

interface Props {
    default: string | undefined;
    onSearch: (term: string) => void;
}

export default function SearchInput(props: Props) {
    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTerm(event.target.value);
        props.onSearch(event.target.value);
    };

    const [term, setTerm] = useState(props.default ? props.default : '');

    return (
        <div className='IncidentList-search'>
            <input
                type='text'
                placeholder='Search by Incident name'
                onChange={onChange}
                value={term}
            />
        </div>
    );
}
