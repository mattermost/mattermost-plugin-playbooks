import {WebSocketMessage} from '@mattermost/client';

export interface PostUpdateWebsocketMessage {
    next: string
    post_id: string
    control?: string
}

type WebsocketListener = (msg: WebSocketMessage<PostUpdateWebsocketMessage>) => void
type WebsocketListeners = Map<string, WebsocketListener>

class PostEventListener {
    postUpdateWebsocketListeners: WebsocketListeners = new Map<string, WebsocketListener>();

    public registerPostUpdateListener = (postID: string, listener: WebsocketListener) => {
        this.postUpdateWebsocketListeners.set(postID, listener);
    };

    public unregisterPostUpdateListener = (postID: string) => {
        this.postUpdateWebsocketListeners.delete(postID);
    };

    public handlePostUpdateWebsockets = (msg: WebSocketMessage<PostUpdateWebsocketMessage>) => {
        const postID = msg.data.post_id;
        this.postUpdateWebsocketListeners.get(postID)?.(msg);
    };
}

const postEventListener = new PostEventListener()
export default postEventListener;
