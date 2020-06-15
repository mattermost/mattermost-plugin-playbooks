import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {Backstage} from './backstage';

const mapStateToProps = (state: GlobalState): object => {
    const currentTeam = getCurrentTeam(state);

    return {
        currentTeamId: currentTeam.id,
        currentTeamName: currentTeam.name,
        currentTeamDisplayName: currentTeam.display_name,
    };
};

export default connect(mapStateToProps, null)(Backstage);
