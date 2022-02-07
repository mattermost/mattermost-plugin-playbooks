// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';

import {useIntl} from 'react-intl';

import {BaseInput} from 'src/components/assets/inputs';

interface Props {
    title: string;
    value: string;
    placeholder: string;
    helpText: string;
    errorText: string;
    targetValue?: string;
    inputIcon: JSX.Element;
    inputRef?: React.MutableRefObject<null>
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    disabled?: boolean;
}

const MetricInput = ({title, value, placeholder, helpText, errorText, targetValue, inputIcon, inputRef: textareaRef, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <Container>
            <Header>
                <Bold>{title}</Bold>
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
            <HelpText>{helpText}</HelpText>
        </Container>
    );
};

const Container = styled.div`
    flex: 1;
`;

const Bold = styled.div`
    font-weight: 600;
`;

const HelpText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const Error = ({text}: { text: string }) => (
    text === '' ? null : <ErrorText>{text}</ErrorText>
);

const ErrorText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: var(--error-text);
`;

const StyledInput = styled(BaseInput)<{ error?: boolean }>`
    height: 40px;
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
        return (<></>);
    }
    return (
        <TargetTitle>
            <Bold>{title}</Bold>
            <ValueText>{text}</ValueText>
        </TargetTitle>
    );
};

const ValueText = styled.span`
    padding-left: 0.3em;
`;

export default MetricInput;
