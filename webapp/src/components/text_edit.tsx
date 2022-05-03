import React, {useState} from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {useSelector} from 'react-redux';
import {Team} from 'mattermost-redux/types/teams';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {formatText, messageHtmlToComponent} from 'src/webapp_globals';
import {ChannelNamesMap} from 'src/types/backstage';
import {HoverMenuButton} from 'src/components/rhs/rhs_shared';

import {CancelSaveButtons} from './checklist_item/inputs';

interface TextEditProps {
    value: string;
    onSave: (value: string) => void;
    placeholder: string;
    className?: string;
}

const TextEdit = (props: TextEditProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [value, setValue] = useState(props.value);

    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);

    const markdownOptions = {
        singleline: true,
        mentionHighlight: false,
        atMentions: true,
        team,
        channelNamesMap,
    };

    const computeHeight = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        e.target.style.height = '5px';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    };

    if (isEditing) {
        return (
            <EditTextContainer dashed={false}>
                <RenderedEditableText
                    className={props.className}
                    data-testid={'rendered-editable-text'}
                    value={value}
                    placeholder={props.placeholder}
                    onChange={(e) => setValue(e.target.value)}
                    autoFocus={true}
                    onFocus={(e) => {
                        const val = e.target.value;
                        e.target.value = '';
                        e.target.value = val;
                        computeHeight(e);
                    }}
                    onInput={computeHeight}
                />
                <CancelSaveButtons
                    onCancel={() => {
                        setShowMenu(false);
                        setIsEditing(false);
                        setValue(props.value);
                    }}
                    onSave={() => {
                        setShowMenu(false);
                        setIsEditing(false);
                        props.onSave(value);
                    }}
                />
            </EditTextContainer>
        );
    }

    return (
        <EditTextContainer
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
            dashed={value === ''}
        >
            {showMenu && !isEditing && <HoverMenu onEdit={() => setIsEditing(true)}/>}
            <RenderedText
                className={props.className}
                data-testid='rendered-text'
            >
                {value ? (
                    <div>
                        {messageHtmlToComponent(formatText(value, {...markdownOptions, singleline: false}), true, {})}
                    </div>
                ) : (
                    <PlaceholderText>{props.placeholder}</PlaceholderText>
                )}
            </RenderedText>
        </EditTextContainer>
    );
};

const EditTextContainer = styled.div<{dashed: boolean}>`
    position: relative;

    box-sizing: border-box;
    border-radius: 8px; 

    background: var(--center-channel-bg);
    border: ${(props) => (props.dashed ? '1px dashed var(--center-channel-color-16)' : '1px solid var(--center-channel-color-08)')};
`;

const commonTextStyle = css`
    display: flex;
    align-items: center;
    border-radius: 5px;
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    color: var(--center-channel-color-72);
    padding: 16px 24px;

    :hover {
        cursor: text;
    }

    p {
        white-space: pre-wrap;
    }
`;

const RenderedText = styled.div`
    ${commonTextStyle}

    p:last-child {
        margin-bottom: 0;
    }
`;

const RenderedEditableText = styled.textarea`
    ${commonTextStyle} {
    }

    display: block;
    resize: none;
    width: 100%;
    overflow: hidden;
    border: 2px solid var(--button-bg);
    background: var(--button-bg-08);
`;

const PlaceholderText = styled.span`
    font-style: italic;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color-56);
`;

export default TextEdit;

interface HoverMenuProps {
    onEdit: () => void;
}

const HoverMenu = (props: HoverMenuProps) => {
    const {formatMessage} = useIntl();

    return (
        <HoverMenuContainer>
            <HoverMenuButton
                data-testid='hover-menu-edit-button'
                title={formatMessage({defaultMessage: 'Edit'})}
                className={'icon-pencil-outline icon-16 btn-icon'}
                onClick={() => props.onEdit()}
            />
        </HoverMenuContainer>
    );
};

const HoverMenuContainer = styled.div`
    display: flex;
    align-items: center;
    padding: 0px 8px;
    position: absolute;
    height: 32px;
    right: 2px;
    top: 8px;
`;
