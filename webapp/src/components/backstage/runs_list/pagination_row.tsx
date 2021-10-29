// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

const PaginationRowDiv = styled.div`
    margin: 10px 0 20px;
    font-size: 14px;
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

export default function PaginationRow(props: Props) {
    function onPrevPage() {
        props.setPage(Math.max(props.page - 1, 0));
    }

    function onNextPage() {
        props.setPage(props.page + 1);
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
                            <FormattedMessage defaultMessage='Previous'/>
                        </Button>
                    }
                </div>
                <CountDiv className='text-center col-sm-8'>
                    <FormattedMessage
                        defaultMessage='{from, number}–{to, number} of {total, number} total'
                        values={countInfo(props)}
                    />
                </CountDiv>
                <div className='text-center col-sm-2'>
                    {
                        showNextPage &&
                        <Button
                            className='btn btn-link'
                            onClick={onNextPage}
                        >
                            <FormattedMessage defaultMessage='Next'/>
                        </Button>}
                </div>
            </div>
        </PaginationRowDiv>
    );
}

function countInfo(props: Props) {
    const start = props.page * props.perPage;
    const to = Math.min(start + props.perPage, props.totalCount);
    const from = props.totalCount === 0 ? 0 : start + 1;

    return {from, to, total: props.totalCount};
}
