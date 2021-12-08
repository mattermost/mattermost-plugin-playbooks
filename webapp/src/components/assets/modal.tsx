import React from 'react';
import styled, {css} from 'styled-components';

import {BaseInput} from 'src/components/assets/inputs';

export const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    color: var(--center-channel-color);
`;

interface ModalFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'capture'> {
    id: string;
    label?: string;
    value: string;
}

export const ModalField = ({id, label, ...props}: ModalFieldProps) => {
    return (
        <>
            <Input
                {...props}
                id={id}
                type={'text'}
            />
            <Label
                htmlFor={id}
                value={props.value}
            >{label}</Label>
        </>
    );
};

const Label = styled.label<{value: string}>`
    position: absolute;
    top: 12px;
    margin-left: 11px;

    font-size: 14px;
    font-weight: normal;

    color: rgba(var(--center-channel-color-rgb), 0.64);
    background: var(--center-channel-bg);

    padding: 0;
    width: max-content;

    transition: all 0.1s linear;

    ${({value}) => value.trim().length > 0 && css`
        top: -6px;
        font-size: 10px;
        padding: 0 4px;
    `}
`;

const Input = styled(BaseInput)<{value: string}>`
    width: 100%;
    height: 48px;
    padding: 12px 16px;
    font-size: 16px;

    :focus + ${Label} {
        top: -6px;
        padding: 0 4px;
        font-size: 10px;
        color: var(--button-bg);
    }
`;
