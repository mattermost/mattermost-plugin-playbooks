import React, {FC, useState, useRef} from 'react';

import styled, {createGlobalStyle} from 'styled-components';

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

const AutocompleteWrapper = styled.div`
    flex-grow: 1;
    height: 40px;
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

const OverrideWebappStyle = createGlobalStyle`
    .custom-textarea.custom-textarea {
        height: 40px;
        min-height: 40px;
    }

    .custom-textarea.custom-textarea:focus {
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
        padding: 0 16px;
    }
`;

// @ts-ignore
const AutocompleteTextbox = window.Components.Textbox;

const StepEdit: FC<StepEditProps> = (props: StepEditProps) => {
    const commandInputRef = useRef(null);
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
                <OverrideWebappStyle/>
                <AutocompleteWrapper>
                    <AutocompleteTextbox
                        ref={commandInputRef}
                        inputComponent={StepInput}
                        createMessage={'Slash Command'}
                        onKeyDown={(e: KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === 'Escape') {
                                if (commandInputRef.current) {
                                // @ts-ignore
                                    commandInputRef.current!.blur();
                                }
                            }
                        }}
                        onChange={(e: React.FormEvent<HTMLInputElement>) => {
                            if (e.target) {
                                const input = e.target as HTMLInputElement;
                                setStepCommand(input.value);
                            }
                        }}
                        suggestionListStyle={'top'}
                        type='text'
                        value={stepCommand}
                        onBlur={submit}

                        // the following are required props but aren't used
                        characterLimit={256}
                        onKeyPress={() => true}
                    />
                </AutocompleteWrapper>
            </StepLine>
            {description}
        </Container>
    );
};

export default StepEdit;
