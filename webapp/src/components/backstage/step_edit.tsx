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
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    border-radius: 4px;
    background-color: var(--center-channel-bg);
    padding: 20px;
`;

const StepLine = styled.div`
    display: flex;
    direction: row;
`;

const StepInput = styled.input`
    -webkit-transition: border-color ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;
    transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;
    background-color: rgb(var(--center-channel-bg-rgb));
    border: none;
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    margin-right: 20px;
    height: 40px;
    line-height: 40px;
    padding: 0 16px;
    flex-grow: 1;
    font-size: 14px;

    &:focus {
        box-shadow: inset 0 0 0 2px var(--button-bg);
    }
`;

const AutocompleteWrapper = styled.div`
    flex-grow: 1;
    height: 40px;
    line-height: 40px;
`;

const DescriptionContainer = styled.div`
    padding: 0 20px 0 0;
    width: 50%;
`;

const Description = styled.textarea`
    -webkit-transition: border-color ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;
    transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;
    width: 100%;
    resize: none;
    height: 100px;
    background-color: rgb(var(--center-channel-bg-rgb));
    border: none;
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    margin: 16px 0 0 0;
    padding: 10px 16px;
    font-size: 14px;

    &:focus {
        box-shadow: inset 0 0 0 2px var(--button-bg);
    }
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

    &:hover {
        color: rgba(var(--center-channel-color-rgb));
    }
`;

const OverrideWebappStyle = createGlobalStyle`
    .custom-textarea.custom-textarea {
        border: none;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        height: 40px;
        min-height: 40px;
    }

    .custom-textarea.custom-textarea:focus {
        border: none;
        box-shadow: inset 0 0 0 2px var(--button-bg);
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
            <i className='icon-plus icon-12 icon--no-spacing mr-1'/>
            {'Add Optional Description'}
        </AddDescription>
    );

    const removeDescriptionBox = (
        <AddDescription
            onClick={() => setDescriptionPressed(false)}
        >
            <i className='icon-trash-can-outline icon-12 icon--no-spacing mr-1'/>
            {'Remove Optional Description'}
        </AddDescription>
    );

    if (description || descriptionPressed) {
        descriptionBox = (
            <React.Fragment>
                <Description
                    value={description}
                    onBlur={submit}
                    autoFocus={descriptionPressed}
                    placeholder={'Description'}
                    onChange={(e) => {
                        setDescription(e.target.value);
                    }}
                />
                {removeDescriptionBox}
            </React.Fragment>
        );
    }

    return (
        <Container>
            <StepLine>
                <StepInput
                    placeholder={'Task Name'}
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
            <DescriptionContainer>
                {descriptionBox}
            </DescriptionContainer>
        </Container>
    );
};

export default StepEdit;
