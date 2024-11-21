import {WebSocketMessage} from '@mattermost/client';
import React, {ChangeEvent, useEffect, useState, useCallback} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';

import {generateStatusUpdate} from './client';

import postEventListener, {PostUpdateWebsocketMessage} from './websocket';

const Textbox = window.Components.Textbox;

type Props = {
    playbookRunId: string
    generating: boolean
    onGeneratingChanged: (generating: boolean) => void
}

const AIModal = ({generating, playbookRunId, onGeneratingChanged}: Props) => {
    const intl = useIntl();
    const [update, setUpdate] = useState('');

    useEffect(() => {
        postEventListener.registerPostUpdateListener('playbooks_post_update', (msg: WebSocketMessage<PostUpdateWebsocketMessage>) => {
            const data = msg.data;
            if (!data.control) {
                onGeneratingChanged(true);
                setUpdate(data.next);
            } else if (data.control === 'end') {
                onGeneratingChanged(false);
            }
        });

        generateStatusUpdate(playbookRunId);

        return () => {
            postEventListener.unregisterPostUpdateListener('playbooks_post_update');
        };
    }, []);

    const regenerate = useCallback(() => {
        generateStatusUpdate(playbookRunId);
    }, [playbookRunId]);

    const copyText = useCallback(() => {
      navigator.clipboard.writeText(update);
    }, [update])

    return (
        <AIModalContainer>
            <Textbox
                tabIndex={0}
                value={update}
                emojiEnabled={true}
                supportsCommands={false}
                suggestionListPosition='bottom'
                useChannelMentions={false}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setUpdate(e.target.value)}
                characterLimit={10000}
                createMessage={''}
                onKeyPress={() => true}
                openWhenEmpty={true}
                channelId={''}
                disabled={false}
            />
            {generating &&
              <button>
                <FormattedMessage defaultMessage="stop generating"/>
              </button>
            }
            {!generating &&
              <button>
                <FormattedMessage defaultMessage="insert"/>
              </button>
            }
            {!generating &&
              <button onClick={regenerate}>
                <FormattedMessage defaultMessage="regenerate"/>
              </button>
            }
            {!generating &&
              <button onClick={copyText}>
                <FormattedMessage defaultMessage="copy"/>
              </button>
            }
            <input placeholder={intl.formatMessage({defaultMessage: "What would you like AI to do next?"})} />
        </AIModalContainer>
    );
};

const AIModalContainer = styled.div`
    width: 110%;
    position: absolute;
    z-index: 1000;
`;

export default AIModal;
