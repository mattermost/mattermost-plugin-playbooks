import React, {FC, useState, useRef, useEffect} from 'react';

import styled, {createGlobalStyle} from 'styled-components';

import {ChecklistItem} from 'src/types/playbook';
import {TertiaryButton} from 'src/components/assets/buttons';
import {useUniqueId} from 'src/utils';

import {StyledTextarea} from './styles';

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
    flex: 0.5;
    font-size: 14px;

    &:focus {
        box-shadow: inset 0 0 0 2px var(--button-bg);
    }
`;

const AutocompleteWrapper = styled.div`
    position: relative;
    flex-grow: 1;
    height: 40px;
    line-height: 40px;

    input {
        padding-right: 30px;
    }
`;

const DescriptionContainer = styled.div`
    position: relative;
    width: 100%;
    margin: 16px 0 0 0;
    line-height: 40px;
`;

const AddDescription = styled.button`
    border: none;
    background: none;
    font-size: 12px;
    font-weight: normal;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
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
        padding: 0 30px 0 16px;
    }
`;

const SlashCommandContainer = styled.div`
    flex: 0.5;
`;

interface RemoveProps {
    show: boolean;
}

const Remove = styled.span<RemoveProps>`
    visibility: ${(props) => (props.show ? 'visible' : 'hidden')};
    cursor: pointer;
    position: absolute;
    top: 0px;
    right: 5px;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover {
        color: var(--center-channel-color);
    }
`;

// @ts-ignore
const AutocompleteTextbox = window.Components.Textbox;

interface StepTitleProps {
    title: string;
    setTitle: (title: string) => void;
}

const StepTitle: FC<StepTitleProps> = (props: StepTitleProps) => {
    const [title, setTitle] = useState(props.title);

    const save = () => {
        if (title.trim().length === 0) {
            // Keep the original title from the props.
            setTitle(props.title);
            return;
        }

        props.setTitle(title);
    };

    return (
        <StepInput
            placeholder={'Task Name'}
            type='text'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            autoFocus={!title}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    save();
                }
            }}
        />
    );
};

interface StepDescriptionProps {
    description: string;
    setDescription: (description: string) => void;
}

const StepDescription: FC<StepDescriptionProps> = (props: StepDescriptionProps) => {
    const [description, setDescription] = useState(props.description);
    const [descriptionOpen, setDescriptionOpen] = useState(props.description.length > 0);
    const [hover, setHover] = useState(false);
    const [focus, setFocus] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (focus && ref && ref.current) {
            // @ts-ignore
            ref.current.focus();
            setFocus(false);
        }
    }, [focus, setFocus]);

    const save = () => {
        props.setDescription(description);
    };

    let descriptionBox = (
        <AddDescription
            onClick={() => {
                setDescriptionOpen(true);
                setFocus(true);
            }}
        >
            <i className='icon-plus icon-12 icon--no-spacing mr-1'/>
            {'Add Optional Description'}
        </AddDescription>
    );
    if (descriptionOpen) {
        descriptionBox = (
            <>
                <StyledTextarea
                    ref={ref}
                    value={description}
                    onBlur={save}
                    placeholder={'Description'}
                    onChange={(e) => {
                        setDescription(e.target.value);
                    }}
                />
                <Remove show={hover}>
                    <i
                        className='icon-trash-can-outline icon-12 icon--no-spacing mr-1'
                        onClick={() => {
                            setDescriptionOpen(false);
                            setDescription('');
                            props.setDescription('');
                        }}
                    />
                </Remove>
            </>
        );
    }

    return (
        <DescriptionContainer
            onMouseOver={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            {descriptionBox}
        </DescriptionContainer>
    );
};

interface StepCommandProps {
    command: string;
    setCommand: (command: string) => void;
    autocompleteOnBottom: boolean;
}

const StepCommand: FC<StepCommandProps> = (props: StepCommandProps) => {
    const [command, setCommand] = useState(props.command);
    const [commandOpen, setCommandOpen] = useState(props.command.length > 0);
    const [focus, setFocus] = useState(false);
    const [hover, setHover] = useState(false);
    const ref = useRef(null);
    const id = useUniqueId('step-command-');

    useEffect(() => {
        if (focus && ref && ref.current) {
            // @ts-ignore
            ref.current.focus();
            setFocus(false);
        }
    }, [focus, setFocus]);

    const save = () => {
        // Discard invalid slash commands.
        if (command.trim() === '/' || command.trim() === '') {
            setCommand('');
            props.setCommand('');
            setCommandOpen(false);
        } else {
            props.setCommand(command);
        }
    };

    let slashCommandBox = (
        <TertiaryButton
            onClick={() => {
                setCommandOpen(true);
                setCommand('/');
                setFocus(true);
            }}
        >
            <i className='icon-plus'/>
            {'Add a Slash Command'}
        </TertiaryButton>
    );

    if (commandOpen) {
        slashCommandBox = (<>
            <OverrideWebappStyle/>
            <AutocompleteWrapper>
                <AutocompleteTextbox
                    id={id}
                    ref={ref}
                    inputComponent={StepInput}
                    createMessage={'Slash Command'}
                    onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                            if (ref.current) {
                                // @ts-ignore
                                ref.current.blur();
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
                    onBlur={save}

                    // the following are required props but aren't used
                    characterLimit={256}
                    onKeyPress={() => true}
                    openWhenEmpty={true}
                />
                <Remove show={hover}>
                    <i
                        className='icon-trash-can-outline icon-12 icon--no-spacing mr-1'
                        onClick={() => {
                            setCommandOpen(false);
                            setCommand('');
                            props.setCommand('');
                        }}
                    />
                </Remove>
            </AutocompleteWrapper>
        </>);
    }

    return (
        <SlashCommandContainer
            onMouseOver={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            {slashCommandBox}
        </SlashCommandContainer>
    );
};

const StepEdit: FC<StepEditProps> = (props: StepEditProps) => {
    const submit = (step: ChecklistItem) => {
        props.onUpdate(step);
    };

    return (
        <Container>
            <StepLine>
                <StepTitle
                    title={props.step.title}
                    setTitle={(title) => submit({...props.step, title})}
                />
                <StepCommand
                    command={props.step.command}
                    setCommand={(command) => submit({...props.step, command})}
                    autocompleteOnBottom={props.autocompleteOnBottom}
                />
            </StepLine>
            <StepDescription
                description={props.step.description}
                setDescription={(description) => submit({...props.step, description})}
            />
        </Container>
    );
};

export default StepEdit;
