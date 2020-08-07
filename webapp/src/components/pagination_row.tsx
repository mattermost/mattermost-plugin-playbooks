// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

const PaginationRowDiv = styled.div`
    margin: 10px 0 20px;
    font-size: 14px;

    button {
        font-weight: bold;
    }
`;

const CountDiv = styled.div`
    padding-top: 8px;
    color: var(--center-channel-color-56);
`;

const Button = styled.button`
    font-weight: bold;
`;

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
        const firstNumber = props.totalCount === 0 ? 0 : startCount + 1;

        return firstNumber + ' - ' + endCount + ' of ' + props.totalCount + ' total';
    }

    const showNextPage = ((props.page + 1) * props.perPage) < props.totalCount;

    return (
        <PaginationRowDiv>
            <div className='row'>
                <div className='text-center col-sm-2'>
                    {
                        (props.page > 0) &&
                        <Button
                            className='btn btn-link'
                            onClick={onPrevPage}
                        >
                            {'Previous'}
                        </Button>
                    }
                </div>
                <CountDiv className='text-center col-sm-8'>{countInfo()}</CountDiv>
                <div className='text-center col-sm-2'>
                    {
                        showNextPage &&
                        <Button
                            className='btn btn-link'
                            onClick={onNextPage}
                        >
                            {'Next'}
                        </Button>}
                </div>
            </div>
        </PaginationRowDiv>
    );
}
