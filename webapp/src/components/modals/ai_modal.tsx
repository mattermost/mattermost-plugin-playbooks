import {WebSocketMessage} from '@mattermost/client';
import React, {useEffect, useState, useCallback, useRef} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import IconAI from 'src/components/assets/icons/ai';
import {Textbox} from 'src/webapp_globals';

import {generateStatusUpdate} from 'src/client';
import {useAIAvailableBots, useBotSelector} from 'src/ai_integration';

import postEventListener, {PostUpdateWebsocketMessage} from 'src/websocket';

type Version = {
  instruction: string
  prevValue: string
  value: string
}

type Props = {
    playbookRunId: string
    onAccept: (text: string) => void
    onClose: () => void
}

const AIModal = ({playbookRunId, onAccept, onClose}: Props) => {
    const intl = useIntl();
    const [copied, setCopied] = useState(false);
    const [instruction, setInstruction] = useState('');
    const suggestionBox = useRef<HTMLDivElement>()
    const aiAvailableBots = useAIAvailableBots();
    const BotSelector = useBotSelector() as any;
    const [currentBot, setCurrentBot] = useState<any>(aiAvailableBots.length > 0 ? aiAvailableBots[0] : null);
    const [currentVersion, setCurrentVersion] = useState<number>(1);
    const [versions, setVersions] = useState<Version[]>([]);
    const [generating, setGenerating] = useState<any>(null);

    useEffect(() => {
        if (currentBot?.id) {
          setCurrentVersion(versions.length + 1)
          setVersions([...versions, {instruction: '', value: '', prevValue: ''}])
          setGenerating(true);
          generateStatusUpdate(playbookRunId, currentBot.id, [], []);
        }
    }, []);

    useEffect(() => {
        if (generating) {
            postEventListener.registerPostUpdateListener('playbooks_post_update', (msg: WebSocketMessage<PostUpdateWebsocketMessage>) => {
              const data = msg.data;
              if (!data.control) {
                setGenerating(true);
                const newVersions = [...versions]
                newVersions[versions.length-1] = {...newVersions[versions.length-1], value: data.next}
                setVersions(newVersions)
                setTimeout(() => suggestionBox.current?.scrollTo(0, suggestionBox.current?.scrollHeight), 0)
              } else if (data.control === 'end') {
                setGenerating(false);
              }
            });
        }
        return () => {
            postEventListener.unregisterPostUpdateListener('playbooks_post_update');
        };
    }, [generating]);

    const onBotChange = useCallback((bot: any) => {
      setCurrentBot(bot)
      setCurrentVersion(versions.length + 1)
      setVersions([...versions, {instruction: '', value: '', prevValue: ''}])
      setGenerating(true);
      generateStatusUpdate(playbookRunId, bot.id, [], []);
    }, [versions, playbookRunId])

    const regenerate = useCallback(() => {
        setGenerating(true);
        generateStatusUpdate(playbookRunId, currentBot?.id, [versions[currentVersion-1].instruction], [versions[currentVersion-1].prevValue]);
        setCurrentVersion(versions.length + 1)
        setVersions([...versions, {...versions[currentVersion-1], value: ''}])
    }, [versions, playbookRunId, instruction, versions, currentVersion, currentBot?.id]);

    const copyText = useCallback(() => {
      navigator.clipboard.writeText(versions[currentVersion-1].value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    }, [versions, currentVersion])

    const onInputEnter = useCallback((e: React.KeyboardEvent) => {
      // Detect hitting enter and run the generateStatusUpdate
      if (e.key === 'Enter') {
        generateStatusUpdate(playbookRunId, currentBot?.id, [instruction], [versions[currentVersion-1].value]);
        setVersions([...versions, {instruction, prevValue: versions[currentVersion-1].value, value: ''}])
        setCurrentVersion(versions.length + 1)
        setInstruction('')
        setGenerating(true);
        setTimeout(() => suggestionBox.current?.scrollTo(0, suggestionBox.current?.scrollHeight), 0)
      }
    }, [versions, instruction, playbookRunId, versions, currentVersion, currentBot?.id])

    const stopGenerating = useCallback(() => {
        setGenerating(false);
    }, [])

    if (!currentBot?.id) {
        return null
    }

    return (
        <AIModalContainer>
            <TopBar>
              <Versions>
                <i className={"icon icon-arrow-back-ios" + (currentVersion === 1 ? ' disabled' : '')} onClick={() => setCurrentVersion(currentVersion-1)}/>
                <FormattedMessage defaultMessage="version {number} of {total}" values={{number: currentVersion, total: versions.length}}/>
                <i className={"icon icon-arrow-forward-ios" + (currentVersion === versions.length ? ' disabled' : '')} onClick={() => setCurrentVersion(currentVersion+1)}/>
              </Versions>
              <BotSelector
                  bots={aiAvailableBots || []}
                  activeBot={currentBot}
                  setActiveBot={onBotChange}
              />
            </TopBar>
            <AssistantMessageBox ref={suggestionBox}>
              <Textbox value={versions[currentVersion-1]?.value || ''} preview={true}/>
            </AssistantMessageBox>

            {generating &&
              <StopGeneratingButton onClick={stopGenerating}>
                <i className="icon icon-cancel"/>
                <FormattedMessage defaultMessage="stop generating"/>
              </StopGeneratingButton>
            }
            {!generating &&
              <>
                <IconButton onClick={copyText}>
                  <i className="icon icon-content-copy"/>
                </IconButton>
                <IconButton onClick={regenerate}>
                  <i className="icon icon-refresh"/>
                </IconButton>
                <IconButton onClick={onClose}>
                  <i className="icon icon-trash-can-outline"/>
                </IconButton>
                <InsertButton onClick={() => onAccept(versions[currentVersion-1].value)}>
                  <i className="icon icon-check"/>
                  <FormattedMessage defaultMessage="insert"/>
                </InsertButton>
              </>
            }
            <Copied copied={copied}>
              <FormattedMessage defaultMessage="Copied!"/>
            </Copied>
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
    width: 480px;
    right: -2px;
    top: -10px;
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
    margin: 12px 12px 12px 0;
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

const AssistantMessageBox = styled.div`
    max-height: 200px;
    height: 200px;
    overflow-y: auto;
    &&&& .custom-textarea {
        border: none;
        box-shadow: none;
        height: 100%;
    }
`

const Copied = styled.span<{copied: boolean}>`
    color: var(--center-channel-color-64);
    margin: 12px 0px;
    transition: opacity 1s;
    opacity: ${(props) => (props.copied ? 1 : 0)};
`

const TopBar = styled.div`
    display: flex;
    justify-content: space-between;
`

const Versions = styled.div`
    display: flex;
    align-items: center;
    color: var(--center-channel-color-75);
    .icon {
        cursor: pointer;
        opacity: 0.5;
    }
    .icon.disabled {
        cursor: auto;
        pointer-events: none;
        opacity: 0.2;
    }
`

export default AIModal;
