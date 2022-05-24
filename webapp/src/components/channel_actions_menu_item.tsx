import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {connect} from 'react-redux';

const mapStateToProps = (state : any) => ({
    channel: getCurrentChannel(state),
});

const ChannelActions = (props : any) => {
    if (
        props.channel.type === 'D' ||
        props.channel.type === 'G'
    ) {
        return null;
    }

    return <p> Channel Actions </p>;
};

export const ChannelActionsMenuItem = connect(mapStateToProps)(ChannelActions);
