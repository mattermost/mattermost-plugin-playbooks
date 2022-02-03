// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mdiCurrencyUsd, mdiPound} from '@mdi/js';

import Icon from '@mdi/react';

import styled, {css} from 'styled-components';

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import {BaseInput} from 'src/components/assets/inputs';

import {VerticalSpacer} from 'src/components/backstage/playbook_runs/shared';

import {PlaybookRun} from 'src/types/playbook_run';

interface MetricsProps {
    playbookRun: PlaybookRun;
    isPublished: boolean;
}

interface Metric {
    val: string;
    id: string;
}

const MetricsData = (props: MetricsProps) => {
    const metrics = [1, 2, 3];
    const metricsValues = [{val: '9', id: '1'}, {val: '92', id: '2'}, {val: '19', id: '3'}];
    const {formatMessage} = useIntl();
    const [targetError, setTargetError] = useState('');
    const [curState, setCurState] = useState<Metric[]>(metricsValues);

    function updateMetrics(index: number, event: React.ChangeEvent<HTMLInputElement>) {
        const newList = [...curState];
        newList[index].val = event.target.value;
        setCurState(newList);
        setTargetError('');
    }

    return (
        <div>
            {
                metrics.map((metric, idx) => {
                    let typeTitle = ' Dollars';
                    let searchIcon = <DollarSign size={1}/>;
                    if (metric === 1) {
                        typeTitle = ' Integer';
                        searchIcon = <PoundSign size={1}/>;
                    } else if (metric === 2) {
                        typeTitle = 'Duration (in dd:hh:mm)';
                        searchIcon = <i className='icon-clock-outline'/>;
                    }

                    return (
                        <>
                            <VerticalSpacer size={24}/>
                            <Title>{'Target per run'}</Title>
                            <InputWithIcon>
                                {searchIcon}
                                <StyledInput
                                    placeholder={typeTitle}
                                    type='text'
                                    value={curState[idx].val}
                                    onChange={(e) => updateMetrics(idx, e)}
                                    disabled={props.isPublished}
                                />
                            </InputWithIcon>
                            {
                                targetError !== '' &&
                                <ErrorText>{targetError}</ErrorText>
                            }
                            <HelpText>{formatMessage({defaultMessage: 'We’ll show you how close or far from the target each run’s value is and also plot it on a chart.'})}</HelpText>
                        </>
                    );
                })
            }
        </div>
    );
};
const DollarSign = ({size}: {size: number}) => (
    <Icon
        path={mdiCurrencyUsd}
        size={size}
    />
);

const PoundSign = ({size}: {size: number}) => (
    <Icon
        path={mdiPound}
        size={size}
    />
);

const HelpText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const ErrorText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: var(--error-text);
`;
const Title = styled.div`
    font-weight: 600;
    margin: 0 0 8px 0;
`;

const InputWithIcon = styled.span`
    position: relative;

    i, svg {
        position: absolute;
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }

    i {
        left: 10px;
        top: 0;
    }

    svg {
        left: 14px;
        top: 2px;
    }

    input {
        padding-left: 36px;
    }
`;

const StyledInput = styled(BaseInput)<{ error?: boolean }>`
    width: 100%;

    ${(props) => (
        props.error && css`
            box-shadow: inset 0 0 0 1px var(--error-text);

            &:focus {
                box-shadow: inset 0 0 0 2px var(--error-text);
            }
        `
    )}
`;

export default MetricsData;
