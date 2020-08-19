import React, {FC, useState, useRef} from 'react';

import styled, {createGlobalStyle} from 'styled-components';

import {ChecklistItem} from 'src/types/playbook';

export interface StepEditProps {
    step: ChecklistItem;
    onUpdate: (updatedStep: ChecklistItem) => void
    autocompleteOnBottom: boolean;
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
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
    const [title, setTitle] = useState(props.step.title);
    const [command, setCommand] = useState(props.step.command);
    const [description, setDescription] = useState(props.step.description);
    const [descriptionPressed, setDescriptionPressed] = useState(false);

    const submit = () => {
        if (title !== props.step.title ||
            command !== props.step.command ||
                description !== props.step.description) {
            props.onUpdate({
                ...props.step,
                title,
                command,
                description,
            });
        }
    };

    let descriptionBox = (
        <AddDescription
            onClick={() => setDescriptionPressed(true)}
        >
            <i className='icon-plus'/>
            {'Add Optional Description'}
        </AddDescription>
    );

    if (description || descriptionPressed) {
        descriptionBox = (
            <Description
                value={description}
                onBlur={submit}
                autoFocus={descriptionPressed}
                placeholder={'Description'}
                onChange={(e) => {
                    setDescription(e.target.value);
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
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={submit}
                    autoFocus={!title}
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
                                setCommand(input.value);
                            }
                        }}
                        suggestionListStyle={props.autocompleteOnBottom ? 'bottom' : 'top'}
                        type='text'
                        value={command}
                        onBlur={submit}

                        // the following are required props but aren't used
                        characterLimit={256}
                        onKeyPress={() => true}
                    />
                </AutocompleteWrapper>
            </StepLine>
            {descriptionBox}
        </Container>
    );
};

export default StepEdit;
