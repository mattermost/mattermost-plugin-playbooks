import {WebSocketMessage} from '@mattermost/client';
import {useSelector} from 'react-redux';
import {Client4} from 'mattermost-redux/client';
import React, {useEffect, useState, useCallback, useRef} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import IconAI from 'src/components/assets/icons/ai';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {generateStatusUpdate} from './client';

import postEventListener, {PostUpdateWebsocketMessage} from './websocket';

const UserAvatar = window.Components.Avatar;

type Props = {
    playbookRunId: string
    generating: boolean
    currentBot: any
    onGeneratingChanged: (generating: boolean) => void
    onAccept: (text: string) => void
}

const AIModal = ({generating, playbookRunId, onGeneratingChanged, onAccept, currentBot}: Props) => {
    const intl = useIntl();
    const currentUser = useSelector(getCurrentUser);
    const [prevMessages, setPrevMessages] = useState<string[]>([]);
    const [update, setUpdate] = useState('');
    const [instructions, setInstructions] = useState<string[]>([]);
    const [instruction, setInstruction] = useState('');
    const suggestionBox = useRef<HTMLDivElement>()

    useEffect(() => {
        generateStatusUpdate(playbookRunId, instructions);
    }, []);

    useEffect(() => {
        if (generating) {
            postEventListener.registerPostUpdateListener('playbooks_post_update', (msg: WebSocketMessage<PostUpdateWebsocketMessage>) => {
              const data = msg.data;
              if (!data.control) {
                onGeneratingChanged(true);
                setUpdate(data.next);
                setTimeout(() => suggestionBox.current?.scrollTo(0, suggestionBox.current?.scrollHeight), 0)
              } else if (data.control === 'end') {
                onGeneratingChanged(false);
              }
            });
        }
        return () => {
            postEventListener.unregisterPostUpdateListener('playbooks_post_update');
        };
    }, [generating]);

    const regenerate = useCallback(() => {
        setUpdate('')
        onGeneratingChanged(true);
        generateStatusUpdate(playbookRunId, instructions);
    }, [playbookRunId, instructions]);

    const copyText = useCallback(() => {
      navigator.clipboard.writeText(update);
    }, [update])

    const onInputEnter = useCallback((e: React.KeyboardEvent) => {
      // Detect hitting enter and run the generateStatusUpdate
      if (e.key === 'Enter') {
        setPrevMessages([...prevMessages, update])
        setUpdate('')
        generateStatusUpdate(playbookRunId, [...instructions, instruction]);
        setInstructions([...instructions, instruction])
        setInstruction('')
        onGeneratingChanged(true);
        setTimeout(() => suggestionBox.current?.scrollTo(0, suggestionBox.current?.scrollHeight), 0)
      }
    }, [instructions, instruction, playbookRunId, prevMessages, update])

    const stopGenerating = useCallback(() => {
        onGeneratingChanged(false);
    }, [])

    return (
        <AIModalContainer>
            <AssistantMessageBox ref={suggestionBox}>
              {prevMessages.map((msg, idx) => (
                <>
                  <Assistant>
                    <UserAvatar
                        url={Client4.getProfilePictureUrl(currentBot.id, 0)}
                        username={currentBot.displayName}
                    />
                    <Username>{currentBot.displayName}</Username>
                  </Assistant>
                  <Messages>{msg}</Messages>
                  <Assistant>
                    <UserAvatar
                        url={Client4.getProfilePictureUrl(currentUser.id, 0)}
                        username={currentUser.username}
                    />
                      <Username>
                          <FormattedMessage
                              id={'post_priority.you.acknowledge'}
                              defaultMessage={'(you)'}
                          />
                      </Username>
                  </Assistant>
                  <Messages>{instructions[idx]}</Messages>
                </>
              ))}

              <Assistant>
                <UserAvatar
                    url={Client4.getProfilePictureUrl(currentBot.id, 0)}
                    username={currentBot.displayName}
                />
                <Username>{currentBot.displayName}</Username>
              </Assistant>
              <Messages>{update}</Messages>
            </AssistantMessageBox>

            {generating &&
              <StopGeneratingButton onClick={stopGenerating}>
                <i className="icon icon-cancel"/>
                <FormattedMessage defaultMessage="stop generating"/>
              </StopGeneratingButton>
            }
            {!generating &&
              <InsertButton onClick={() => onAccept(update)}>
                <i className="icon icon-check"/>
                <FormattedMessage defaultMessage="insert"/>
              </InsertButton>
            }
            {!generating &&
              <IconButton onClick={regenerate}>
                <i className="icon icon-refresh"/>
              </IconButton>
            }
            {!generating &&
              <IconButton onClick={copyText}>
                <i className="icon icon-content-copy"/>
              </IconButton>
            }
            <ExtraInstructionsInput>
              <IconAI/>
              <input
                placeholder={intl.formatMessage({defaultMessage: "What would you like AI to do next?"})}
                onChange={(e) => setInstruction(e.target.value)}
                value={instruction}
                onKeyUp={onInputEnter}
              />
            </ExtraInstructionsInput>
        </AIModalContainer>
    );
};

const IconButton = styled.span`
    display: inline-block;
    margin: 12px 0px;
    border-radius: 4px;
    background: transparent;
    text-decoration: none;
    color: var(--center-channel-color-64);
    padding: 8px;
    cursor: pointer;
`

const StopGeneratingButton = styled.button`
    display: inline-block;
    margin: 12 0px;
    border-radius: 4px;
    padding: 8px 16px;
    display: inline-block;
    margin: 12px 0px;
    border-radius: 4px;
    background: var(--center-channel-color-08);
    padding: 8px 16px 8px 8px;
    color: var(--center-channel-color-64);
    cursor: pointer;
    text-decoration: none;
    font-weight: 600;
    text-align: center;
    border: 0px;
    &:hover {
      background: var(--center-channel-color-16);
    }
    &:active {
      background: var(--center-channel-color-24);
    }
    &:focus {
      outline: none;
    }
`

const AIModalContainer = styled.div`
    width: 580px;
    left: -23px;
    top: -2px;
    position: absolute;
    z-index: 1000;
    background: var(--center-channel-bg);
    border: 1px solid var(--center-channel-color-16);
    border-radius: 4px;
    padding: 10px;

    &&&& textarea {
        min-height: 220px;
        max-height: 220px;
        border: 0;
        outline: 0;
        box-shadow: none;
        &:focus, &:hover, &:active {
            border: 0;
            outline: 0;
        }
    }
    .autosize_textarea_placeholder {
        display: none;
    }
`;

const ExtraInstructionsInput = styled.div`
    display: flex;
    width: 100%;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid var(--center-channel-color-16);
    align-items: center;
    &:focus {
        border: 1px solid var(--center-channel-color-24);
    }
    input {
        border: 0px;
        width: 100%;
        margin-left: 8px;
    }
    svg {
        color: var(--center-channel-color-64);
    }
`

const InsertButton = styled.button`
    display: inline-block;
    margin: 12px 0px;
    border-radius: 4px;
    background: var(--button-bg-08);
    padding: 8px 16px 8px 8px;
    color: var(--button-bg);
    cursor: pointer;
    text-decoration: none;
    font-weight: 600;
    text-align: center;
    border: 0;
    &:hover {
      background: var(--button-bg-16);
    }
    &:active {
      background: var(--button-bg-24);
    }
    &:focus {
      outline: none;
    }
`

const Assistant = styled.div`
    display: flex;
    .Avatar {
        width: 50px;
        min-width: 50px;
        height: 50px;
        margin-right: 14px;
    }
`

const Username = styled.span`
    font-weight: 600;
`

const Messages = styled.div`
    margin-top: -24px;
    white-space: pre-wrap;
    padding-left: 64px;
    margin-bottom: 16px;
`

const AssistantMessageBox = styled.div`
    max-height: 200px;
    height: 200px;
    overflow-y: auto;
`

export default AIModal;
