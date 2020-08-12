import React, {FC, useState} from 'react';
import styled from 'styled-components';

export interface EditableTextProps {
    text: string
    onChange: (newText: string) => void
}

const Container = styled.span`
    display: inline-flex;
    flex-shrink: 0;
    flex-direction: row;
    align-items: baseline;

    i {
        padding: 0 5px;
    }
`;

const Input = styled.input`
    background: none;
    border: none;
    font: inherit;
    border-bottom: 1px solid;
    width: 500px;
`;

const Text = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 500px;
    white-space: nowrap;
`;

export const ClickableI = styled.i`
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
            <Container>
                <Input
                    type='text'
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
                    className='icon-check'
                    onClick={submit}
                />
            </Container>
        );
    }
    return (
        <Container>
            <Text>
                {text}
            </Text>
            <ClickableI
                className='icon-pencil-outline'
                onClick={() => setEditMode(true)}
            />
        </Container>
    );
};

export default EditableText;
