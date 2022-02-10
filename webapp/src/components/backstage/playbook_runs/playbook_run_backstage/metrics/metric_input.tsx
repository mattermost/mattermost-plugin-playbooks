// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {useIntl} from 'react-intl';

import {StyledInput, HelpText, ErrorText} from '../../shared';

interface Props {
    title: string;
    value: string;
    placeholder: string;
    helpText?: string;
    errorText: string;
    targetValue?: string;
    mandatory?: boolean;
    inputIcon: JSX.Element;
    inputRef?: React.MutableRefObject<null>
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    disabled?: boolean;
}

const MetricInput = ({title, value, placeholder, helpText, errorText, targetValue, mandatory, inputIcon, inputRef: textareaRef, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <InputContainer>
            <Header>
                <Title data-end={mandatory && ' *'}>{title}</Title>
                <Target
                    title={formatMessage({defaultMessage: 'Target'}) + ':'}
                    text={targetValue}
                />
            </Header>
            <InputWithIcon>
                {inputIcon}
                <StyledInput
                    ref={textareaRef}
                    error={errorText !== ''}
                    placeholder={placeholder}
                    type='text'
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                />
            </InputWithIcon>
            <Error text={errorText}/>
            {helpText && <HelpText>{helpText}</HelpText>}
        </InputContainer>
    );
};

const InputContainer = styled.div`
    flex: 1;
`;

const Title = styled.div`
    font-weight: 600;
    
    :after {
        content: attr(data-end);
        color: red;
    }    
`;

const Error = ({text}: { text: string }) => (
    text === '' ? null : <ErrorText>{text}</ErrorText>
);

const InputWithIcon = styled.span`
    position: relative;

    svg {
        position: absolute;
        left: 14px;
        top: 1px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }

    input {
        padding-left: 38px;
    }
`;

const Header = styled.div`
    display: flex;
    flex: 1;
    
    font-size: 14px;
    line-height: 20px;    
    margin: 0 0 8px 0;
`;

const TargetTitle = styled.div`
    flex-grow: 1;
    display: flex;

    align-items: center;
    justify-content: flex-end;

    color: rgba(var(--center-channel-color-rgb), 0.72);    
`;

const Target = ({title, text}: { title: string, text?: string }) => {
    if (!text) {
        return null;
    }
    return (
        <TargetTitle>
            <Title>{title}</Title>
            <ValueText>{text}</ValueText>
        </TargetTitle>
    );
};

const ValueText = styled.span`
    padding-left: 0.3em;
`;

export default MetricInput;
