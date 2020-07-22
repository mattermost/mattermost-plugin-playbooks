import React, {FC, useState} from 'react';

import styled from 'styled-components';

import {ChecklistItem} from 'src/types/playbook';

export interface StepEditProps {
    step: ChecklistItem;
    onUpdate: (updatedStep: ChecklistItem) => void
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(61, 60, 64, 0.08);
    border-radius: 4px;
    background-color: rgba(var(--center-channel-bg-rgb), 0.08);
    padding: 20px;
`;

const StepLine = styled.div`
    display: flex;
    direction: row;
`;

const StepInput = styled.input`
    background-color: rgb(var(--center-channel-bg-rgb));
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    margin-right: 20px;
    height: 40px;
    padding: 0 16px;
    flex-grow: 1;
`;

const Description = styled.textarea`
    background-color: rgb(var(--center-channel-bg-rgb));
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    margin-right: 20px;
    margin-top: 24px;
    padding: 10px 16px;
`;

const AddDescription = styled.button`
    border: none;
    background: none;
    font-size: 12px;
    font-weight: normal;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    margin-top: 8px;
    text-align: left;
`;

const StepEdit: FC<StepEditProps> = (props: StepEditProps) => {
    const [stepTitle, setStepTitle] = useState(props.step.title);
    const [stepCommand, setStepCommand] = useState(props.step.command);
    const [stepDescription, setStepDescription] = useState(props.step.description);
    const [stepDescriptionPressed, setStepDescriptionPressed] = useState(false);

    const submit = () => {
        props.onUpdate({
            ...props.step,
            title: stepTitle,
            command: stepCommand,
            description: stepDescription,
        });
    };

    let description = (
        <AddDescription
            onClick={() => setStepDescriptionPressed(true)}
        >
            <i className='icon-plus'/>
            {'Add Optional Description'}
        </AddDescription>
    );

    if (stepDescription || stepDescriptionPressed) {
        description = (
            <Description
                value={stepDescription}
                onBlur={submit}
                autoFocus={stepDescriptionPressed}
                placeholder={'Description'}
                onChange={(e) => {
                    setStepDescription(e.target.value);
                }}
            />
        );
    }

    return (
        <Container>
            <StepLine>
                <StepInput
                    placeholder={'Step Name'}
                    type='text'
                    value={stepTitle}
                    onChange={(e) => setStepTitle(e.target.value)}
                    onBlur={submit}
                    autoFocus={!stepTitle}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                            submit();
                        }
                    }}
                />
                <StepInput
                    placeholder={'Slash Command'}
                    type='text'
                    value={stepCommand}
                    onChange={(e) => setStepCommand(e.target.value)}
                    onBlur={submit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                            submit();
                        }
                    }}
                />
            </StepLine>
            {description}
        </Container>
    );
};

export default StepEdit;
