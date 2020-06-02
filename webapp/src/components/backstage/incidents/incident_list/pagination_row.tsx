// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

interface Props {
    page: number;
    perPage: number;
    totalCount: number;
    setPage: (page: number) => void;
}

export function PaginationRow(props: Props) {
    function onPrevPage() {
        props.setPage(Math.max(props.page - 1, 0));
    }

    function onNextPage() {
        props.setPage(props.page + 1);
    }

    function countInfo() {
        const startCount = props.page * props.perPage;
        const endCount = Math.min(startCount + props.perPage, props.totalCount);
        return (startCount + 1) + ' - ' + endCount + ' of ' + props.totalCount + ' total';
    }

    const showNextPage = ((props.page + 1) * props.perPage) < props.totalCount;

    return (
        <div className='pagination-row'>
            <div className='row'>
                <div className='text-center col-sm-2'>
                    {
                        (props.page > 0) &&
                        <button
                            className='btn btn-link'
                            onClick={onPrevPage}
                        >
                            {'Previous'}
                        </button>
                    }
                </div>
                <div className='text-center col-sm-8 count'>{countInfo()}</div>
                <div className='text-center col-sm-2'>
                    {
                        showNextPage &&
                        <button
                            className='btn btn-link'
                            onClick={onNextPage}
                        >
                            {'Next'}
                        </button>}
                </div>
            </div>
        </div>
    );
}
