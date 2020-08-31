import React, {FC, useState} from 'react';
import styled from 'styled-components';

export interface EditableTextProps {
    id?: string
    text: string
    onChange: (newText: string) => void
}

const Container = styled.span`
    display: inline-flex;
    flex-shrink: 0;
    flex-direction: row;
    align-items: center;

    i {
        padding: 0 8px;
        color: var(--center-channel-color-56);

        &.icon-check {
            padding: 0 8px 0 0;
        }

        &:hover {
            color: var(--center-channel-color);
        }
    }
`;

const Input = styled.input`
    background: none;
    font: inherit;
    padding: 0 0 2px;
    box-shadow: 0 2px 0 var(--button-bg);
    border: none;
    margin-top: -2px;
    width: 320px;
    padding: 0 0 2px;
`;

const Text = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 450px;
    white-space: nowrap;
`;

const ClickableI = styled.i`
    cursor: pointer;
`;

const EditableText: FC<EditableTextProps> = (props: EditableTextProps) => {
    const [editMode, setEditMode] = useState(false);
    const [text, setText] = useState(props.text);

    const submit = () => {
        setEditMode(false);
        props.onChange(text);
    };

    if (editMode) {
        return (
            <Container id={props.id}>
                <Input
                    type='text'
                    className='editable-input'
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                    }}
                    autoFocus={true}
                    onBlur={submit}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            submit();
                        }
                    }}
                />
                <ClickableI
                    className='editable-trigger icon-check'
                    onClick={submit}
                />
            </Container>
        );
    }
    return (
        <Container
            id={props.id}
            onClick={() => setEditMode(true)}
        >
            <Text>
                {text}
            </Text>
            <ClickableI
                className='editable-trigger icon-pencil-outline'
            />
        </Container>
    );
};

export default EditableText;
